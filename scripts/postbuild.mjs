// After `next build`: generate the service worker with a versioned precache
// list, add GitHub Pages files, and copy the site to docs/ (Pages source).
import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
const DOCS = "docs";

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

writeFileSync(join(OUT, ".nojekyll"), "");

const files = walk(OUT)
  .map((f) => relative(OUT, f).split(sep).join("/"))
  .filter((f) => f !== "sw.js" && f !== ".nojekyll" && !f.endsWith(".map"))
  .sort();

const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest("hex").slice(0, 12);

// "workout/index.html" is requested as "workout/" (trailingSlash export).
const precache = files
  .filter((f) => !f.endsWith(".ics") && f !== "404.html")
  .map((f) => (f === "index.html" ? "./" : f.endsWith("/index.html") ? f.slice(0, -"index.html".length) : f));

const sw = readFileSync("scripts/sw-template.js", "utf8")
  .replace("__VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(precache, null, 0));
writeFileSync(join(OUT, "sw.js"), sw);
writeFileSync(join(OUT, "version.txt"), `${version}\n`);

// Copy to docs/, keeping an already-filled docs/config.js (your server settings).
let keepConfig = null;
const docsConfig = join(DOCS, "config.js");
if (existsSync(docsConfig)) {
  const c = readFileSync(docsConfig, "utf8");
  if (/supabaseUrl:\s*"https:\/\/[^"]+"/.test(c)) keepConfig = c;
}
// Keep video links edited on GitHub (docs/ differs from the shipped public/ file).
let keepVideos = null;
const docsVideos = join(DOCS, "exercise-videos.json");
if (existsSync(docsVideos) && readFileSync(docsVideos, "utf8") !== readFileSync("public/exercise-videos.json", "utf8")) {
  keepVideos = readFileSync(docsVideos, "utf8");
}
if (process.env.FITFLOW_NO_DOCS !== "1") {
  rmSync(DOCS, { recursive: true, force: true });
  cpSync(OUT, DOCS, { recursive: true });
  if (keepConfig) writeFileSync(docsConfig, keepConfig);
  if (keepVideos && process.env.FITFLOW_RESET_VIDEOS !== "1") {
    writeFileSync(docsVideos, keepVideos);
    console.warn("postbuild: kept your edited docs/exercise-videos.json (set FITFLOW_RESET_VIDEOS=1 to replace it)");
  }
}

console.log(`postbuild: ${precache.length} files precached, version ${version}${keepConfig ? ", kept docs/config.js" : ""}`);
