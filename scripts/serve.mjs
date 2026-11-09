// Tiny static server that mimics GitHub Pages for the built site:
//   http://localhost:4321/fitflow/  serves ./out (or the folder given as argv[2])
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] ?? "out";
const port = Number(process.env.PORT ?? 4321);
const base = process.env.FITFLOW_BASE_PATH ?? "/fitflow";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8",
  ".woff2": "font/woff2",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (base && path === "/") {
    res.writeHead(302, { Location: `${base}/` });
    return res.end();
  }
  if (base && !path.startsWith(`${base}/`) && path !== base) {
    res.writeHead(404);
    return res.end("Not found");
  }
  path = path.slice(base.length) || "/";
  let file = normalize(join(root, path));
  if (!file.startsWith(normalize(root))) {
    res.writeHead(403);
    return res.end();
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) {
      res.writeHead(301, { Location: `${base}${path}/${url.search}` });
      return res.end();
    }
    file = join(file, "index.html");
  }
  if (!existsSync(file)) {
    const nf = join(root, "404.html");
    res.writeHead(404, { "Content-Type": types[".html"] });
    return res.end(existsSync(nf) ? readFileSync(nf) : "Not found");
  }
  res.writeHead(200, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`FitFlow preview: http://localhost:${port}${base}/`));
