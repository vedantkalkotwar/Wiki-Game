import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wiki from "./src/wiki.js";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "wiki-proxy",
      configureServer(server) {
        server.middlewares.use("/wiki", (req, res) => {
          console.log("proxy hit:", req.url);
          req.query = { title: req.url.slice(1) };
          wiki(req, res);
        });
      },
    },
  ],
});
