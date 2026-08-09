import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the GOG Newsroom product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="th">/i);
  assert.match(html, /GOG NEWSROOM/);
  assert.match(html, /Manchester United News Intelligence/);
  assert.match(html, /ข่าวล่าสุด/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the exact 18-source directory and durable storage wiring", async () => {
  const [pipeline, newsSources, xSources, hosting, packageJson] = await Promise.all([
    readFile(new URL("../lib/server/pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../config/news-sources.ts", import.meta.url), "utf8"),
    readFile(new URL("../config/x-sources.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(newsSources, /www\.bbc\.com\/sport\/football/);
  assert.match(newsSources, /www\.telegraph\.co\.uk\/football/);
  assert.match(newsSources, /www\.nytimes\.com\/athletic\/uk/);
  assert.match(newsSources, /feeds\.bbci\.co\.uk/);
  assert.match(newsSources, /telegraph\.co\.uk\/football\/rss\.xml/);
  assert.match(newsSources, /nytimes\.com\/athletic\/rss\/football/);
  const configuredHandles = [...xSources.matchAll(/^\s*"([a-z0-9_]+)",?$/gmi)].map((match) => match[1]);
  assert.deepEqual(configuredHandles, [
    "jacobsben", "andymitten", "telegraphducker", "david_ornstein", "fabrizioromano",
    "theathleticfc", "sistoney67", "statszone", "statmandave", "gradient_sports",
    "lauriewhitwell", "lukeedwardstele", "jamespearcelfc", "howardnurse", "simonpeach",
  ]);
  assert.match(newsSources, /X_SOURCE_HANDLES\.map/);
  assert.match(pipeline, /RSS_NEWS_SOURCES\.map/);
  assert.match(pipeline, /titleSimilarity\(.*\) > 0\.8/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.equal(templateRoot.pathname.length > 0, true);
});
