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
  assert.match(html, /Genius on the Ground/);
  assert.match(html, /ข่าวล่าสุด/);
  assert.match(html, /โปรแกรมพรีเมียร์ลีก/);
  assert.match(html, /ทีม GOG/);
  assert.match(html, /GENIUS ON THE GROUND/);
  assert.match(html, /ระบบโดย DM ENGINE™/);
  assert.match(html, /tab-icon-news/);
  assert.match(html, /tab-icon-calendar/);
  assert.match(html, /tab-icon-map/);
  assert.match(html, /tab-icon-tactics/);
  assert.match(html, /tab-icon-team/);
  assert.match(html, /แผนที่สนาม/);
  assert.match(html, /แผนการเล่น/);
  assert.match(html, /dual-clock/);
  assert.match(html, /ไทย · ICT/);
  assert.match(html, /อังกฤษ · GMT\/BST/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the official 38-match 2026/27 fixture calendar and channel analytics wiring", async () => {
  const [fixtures, analytics, hub, api, envExample, layout] = await Promise.all([
    readFile(new URL("../config/mu-fixtures.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/channel-analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/gog-hub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal((fixtures.match(/^\s*fixture\(/gm) ?? []).length, 38);
  assert.match(fixtures, /2026-08-22T11:30:00Z/);
  assert.match(fixtures, /2027-05-30T15:00:00Z/);
  assert.match(fixtures, /Old Trafford/);
  assert.match(fixtures, /PREMIER_LEAGUE_FIXTURE_SOURCE/);
  assert.match(analytics, /youtube\/v3/);
  assert.match(analytics, /forHandle=FootballGeniusAG/);
  assert.match(hub, /ธีรัตน์ ภิรมย์สวัสดิ์/);
  assert.match(hub, /ภัทรเศรษฐ์ เรืองรัตนะกูล/);
  assert.match(hub, /tiktok\.com\/@yo_theerat/);
  assert.match(hub, /youtube\.com\/@FootballGeniusAG/);
  assert.match(api, /\/api\/channel-analytics/);
  assert.match(envExample, /YOUTUBE_API_KEY=/);
  assert.match(layout, /gog-logo-dark\.png/);
});

test("keeps the source directory and durable storage wiring", async () => {
  const [pipeline, newsSources, xSources, hosting, packageJson] = await Promise.all([
    readFile(new URL("../lib/server/pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../config/news-sources.ts", import.meta.url), "utf8"),
    readFile(new URL("../config/x-sources.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(newsSources, /www\.bbc\.com\/sport\/football/);
  assert.match(newsSources, /www\.nytimes\.com\/athletic\/uk/);
  assert.match(newsSources, /feeds\.bbci\.co\.uk/);
  assert.match(newsSources, /nytimes\.com\/athletic\/rss\/football/);
  // The Telegraph ถูกถอดออก 12 ส.ค. 2569 — ระบบกันบอทของเขาตอบ 403 กับทุก
  // user-agent ที่ไม่อยู่ในรายการอนุญาต และ robots.txt ห้ามบอท AI ไว้ชัด
  // ยืนยันว่าไม่มีฟีดเขาค้างอยู่ และมี The Guardian API มาแทนที่แล้ว
  assert.doesNotMatch(newsSources, /telegraph\.co\.uk\/football\/rss\.xml/);
  assert.match(newsSources, /theguardian\.com\/football\/manchester-united/);
  assert.match(newsSources, /API_NEWS_SOURCES/);
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

test("uses the provider-based X public-data collector without official API coupling", async () => {
  const [providers, collector, analyzer, pipeline, api, schema, migration, envExample] = await Promise.all([
    readFile(new URL("../lib/server/x/providers.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/x/collector.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/x/analyzer.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_chemical_masque.sql", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(providers, /interface XDataProvider/);
  assert.match(providers, /class ThirdPartyProvider/);
  assert.match(providers, /class PublicSourceProvider/);
  assert.match(providers, /class MockXProvider/);
  assert.match(providers, /X_ALLOW_MOCK_INGEST === "true"/);
  assert.match(collector, /ensureConfiguredWatchlist/);
  assert.match(collector, /x_collection_jobs/);
  assert.match(collector, /platform_post_id IS NOT NULL/);
  assert.match(collector, /createXAccount/);
  assert.match(collector, /updateXAccount/);
  assert.match(collector, /deactivateXAccount/);
  assert.match(analyzer, /summarizePosts/);
  assert.match(analyzer, /sentimentAnalysis/);
  assert.match(pipeline, /collectXWatchlist/);
  assert.doesNotMatch(pipeline, /api\.x\.com|X_BEARER_TOKEN/);
  assert.match(api, /\/api\/x\/status/);
  assert.match(api, /\/api\/x\/collect-all/);
  assert.match(api, /\/api\/x\/export\/posts\.csv/);
  assert.match(api, /search_not_supported/);
  assert.match(schema, /xAccounts/);
  assert.match(schema, /xPosts/);
  assert.match(schema, /xCollectionJobs/);
  assert.match(migration, /CREATE TABLE `x_accounts`/);
  assert.match(migration, /CREATE TABLE `x_posts`/);
  assert.match(envExample, /X_PROVIDER=/);
  assert.match(envExample, /X_PUBLIC_FEED_URL_TEMPLATE=/);
  assert.doesNotMatch(envExample, /X_BEARER_TOKEN/);
});

test("keeps Bangkok and London clocks on automatic time zones", async () => {
  const newsroom = await readFile(new URL("../app/newsroom.tsx", import.meta.url), "utf8");
  assert.match(newsroom, /Asia\/Bangkok/);
  assert.match(newsroom, /Europe\/London/);
  assert.match(newsroom, /formatClock\(now, "Asia\/Bangkok"\)/);
  assert.match(newsroom, /formatClock\(now, "Europe\/London"\)/);
});

test("maps all 20 fixture grounds with an accessible OpenStreetMap layer", async () => {
  const [locations, travel, mapPanel, fixtures, layout] = await Promise.all([
    readFile(new URL("../config/stadium-locations.ts", import.meta.url), "utf8"),
    readFile(new URL("../config/stadium-travel.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/stadium-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../config/mu-fixtures.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal((locations.match(/^\s*\{ club:/gm) ?? []).length, 20);
  assert.equal((travel.match(/^ {4}stadium:/gm) ?? []).length, 20);
  for (const stadium of ["Old Trafford", "Anfield", "Emirates Stadium", "St James' Park", "Stadium of Light"]) {
    assert.match(locations, new RegExp(stadium.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(fixtures, new RegExp(stadium.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(travel, new RegExp(stadium.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(mapPanel, /tile\.openstreetmap\.org/);
  assert.match(mapPanel, /OpenStreetMap<\/a> contributors/);
  assert.match(mapPanel, /marker\.on\("click"/);
  assert.match(mapPanel, /เวลาไทย/);
  assert.match(mapPanel, /TRAIN FROM MANCHESTER/);
  assert.match(mapPanel, /Europe\/London/);
  assert.match(mapPanel, /เวลาเป้าหมาย/);
  assert.match(mapPanel, /มีโอกาสกลับ Manchester ในคืนเดียวกันไม่ได้/);
  assert.match(travel, /nationalrail\.co\.uk\/journey-planner/);
  assert.match(travel, /tfgm\.com\/plan-a-journey/);
  assert.match(travel, /not live rail timetables/);
  assert.match(layout, /leaflet\/dist\/leaflet\.css/);
});

test("provides an editable visual tactics board backed by the official squad baseline", async () => {
  const [squad, tactics, newsroom] = await Promise.all([
    readFile(new URL("../config/mu-squad.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/tactic-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/newsroom.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal((squad.match(/^\s*\{ id:/gm) ?? []).length, 34);
  for (const player of ["Bruno Fernandes", "Andrey Santos", "Youri Tielemans", "Benjamin Sesko", "Senne Lammens"]) {
    assert.match(squad, new RegExp(player));
  }
  assert.match(squad, /manutd\.com\/en\/players-and-staff\/first-team/);
  assert.match(tactics, /"4-2-3-1"/);
  assert.match(tactics, /"3-4-2-1"/);
  assert.match(tactics, /"4-3-3"/);
  assert.match(tactics, /gog-tactics-squad-v1/);
  assert.match(tactics, /window\.localStorage\.setItem/);
  assert.match(tactics, /MU_PREMIER_LEAGUE_FIXTURES\.map/);
  assert.match(tactics, /เพิ่มผู้เล่น/);
  assert.match(tactics, /แก้ไขข้อมูลนักเตะ/);
  assert.match(tactics, /ไม่ใช่ไลน์อัปยืนยัน/);
  assert.match(newsroom, /<TacticBoardPanel \/>/);
});
