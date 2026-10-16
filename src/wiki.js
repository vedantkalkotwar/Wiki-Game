const inject = (title) => `
<base href="https://en.wikipedia.org/">
<script>
parent.postMessage({ type: "page", title: ${JSON.stringify(title).replace(/</g, "\\u003c")} }, location.origin);

const BLOCKED = /^(File|Special|Help|Category|Talk|Wikipedia|Template|Portal|User|Draft|Module|MediaWiki):/i;
// location.origin is used because the <base> tag would otherwise send relative URLs to wikipedia.org
const go = (t) => location.assign(location.origin + "/wiki/" + encodeURIComponent(t.replace(/ /g, "_")));

document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  e.preventDefault();
  if (a.closest("form, [role=search], .cdx-typeahead-search")) return; // no search shortcuts
  const raw = a.getAttribute("href") || "";
  if (raw.startsWith("#")) {
    document.getElementById(decodeURIComponent(raw.slice(1)))?.scrollIntoView();
    return;
  }
  const u = new URL(a.href);
  if (u.hostname !== "en.wikipedia.org" || !u.pathname.startsWith("/wiki/")) return;
  const t = decodeURIComponent(u.pathname.slice(6));
  if (BLOCKED.test(t)) return;
  go(t);
}, true);

// Search box disabled: using it would skip the race. Remove this listener to allow search.
document.addEventListener("submit", (e) => e.preventDefault(), true);
</script>`;

export default async function handler(req, res) {
  let title = req.query?.title || "Main_Page";
  try { title = decodeURIComponent(title); } catch {}

  const path = title.split("/").map(encodeURIComponent).join("/");
  let r;
  try {
    r = await fetch("https://en.wikipedia.org/wiki/" + path, {
      headers: { "User-Agent": "WikiGame/1.0 (your@email.com)" },
    });
  } catch {
    res.statusCode = 502;
    return res.end("Wikipedia could not be reached");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!r.ok) {
    res.statusCode = r.status;
    return res.end("Page not found");
  }

  let html = await r.text();
  // resolved title (after redirects, e.g. USA -> United_States); may contain \uXXXX escapes
  let resolved = title;
  const m = html.match(/"wgPageName":"((?:[^"\\]|\\.)*)"/);
  if (m) { try { resolved = JSON.parse('"' + m[1] + '"'); } catch { resolved = m[1]; } }

  html = html.replace(/<head[^>]*>/i, (h) => h + inject(resolved));

  res.setHeader("Cache-Control", "s-maxage=3600");
  res.statusCode = 200;
  res.end(html);
}
