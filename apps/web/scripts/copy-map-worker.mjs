// The map library starts its background worker from a file next to its own module. A bundler moves that module, so the file is not
// found and the map stays blank ("Worker failed to load"). This copies the worker from the installed package into public/maplibre/,
// where the app serves it from its own address and tells the library where to find it (see site-location.tsx). Run before dev and build,
// so the copy always matches the installed library version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.join(path.dirname(require.resolve("maplibre-gl/package.json")), "dist");
const out = path.join(import.meta.dirname, "..", "public", "maplibre");
mkdirSync(out, { recursive: true });
copyFileSync(path.join(dist, "maplibre-gl-worker.mjs"), path.join(out, "maplibre-gl-worker.mjs"));
console.log("[map] worker copied to public/maplibre/");
