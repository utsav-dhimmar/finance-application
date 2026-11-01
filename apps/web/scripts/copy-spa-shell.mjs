import { copyFileSync } from "node:fs";

// Cloudflare Workers static assets serve index.html at "/" and as the
// single-page-application fallback for unmatched paths. TanStack Start's
// SPA mode emits the prerendered shell as _shell.html, so bridge the name.
copyFileSync("dist/client/_shell.html", "dist/client/index.html");
