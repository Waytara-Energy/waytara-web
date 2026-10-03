// Measures first-load JavaScript (gzipped) per route by fetching the rendered
// HTML from a running `next start` and summing the <script src> chunks.
// usage: node scripts/first-load-js.mjs http://localhost:3100 / /login /solutions
import { gzipSync } from "node:zlib";
const [base, ...routes] = process.argv.slice(2);
for (const route of routes) {
  const html = await (await fetch(base + route)).text();
  // noModule scripts are legacy-browser polyfills that modern browsers never fetch.
  const srcs = [...new Set([...html.matchAll(/<script([^>]+)>/g)].filter((m) => !/noModule/i.test(m[1])).map((m) => /src="([^"]+)"/.exec(m[1])?.[1]).filter(Boolean))];
  let total = 0;
  for (const s of srcs) {
    const buf = Buffer.from(await (await fetch(new URL(s, base))).arrayBuffer());
    total += gzipSync(buf).length;
  }
  console.log(route.padEnd(24), `${srcs.length} scripts`.padEnd(12), `${(total / 1024).toFixed(0)} KB gzip`);
}
