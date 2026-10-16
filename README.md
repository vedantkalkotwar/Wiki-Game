# Wikipedia Race

A calm, link-following game built with React and Vite. Choose two real Wikipedia articles, then travel between them by following links in the in-game reader. There is no timer.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). To create and inspect a production build, run `npm run build` and `npm run preview`.

## Deploy

Import this project into Vercel or Netlify. Both detect Vite automatically. Use `npm run build` as the build command and `dist` as the publish/output directory. No server-side environment variables or backend are needed.

## Notes

- Article lookup, search, random selection, redirects, and article HTML come from the English Wikipedia MediaWiki API with CORS enabled.
- The reader converts API HTML to React elements, whitelists rendered tags, skips scripts and interface/navigation elements, and only intercepts namespace-free `/wiki/` links. External links open separately.
- Wikipedia text is available under CC BY-SA 4.0; individual media can have separate licenses. Images are served directly from Wikimedia Commons.
- Network access to `en.wikipedia.org` is required. The reader currently targets English Wikipedia.
