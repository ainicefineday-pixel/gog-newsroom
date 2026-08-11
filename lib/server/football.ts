// ชั้นเซิร์ฟเวอร์ของ Match Center — แคช โควตา และการประกอบข้อมูล
// (STEP 8, 9, 10, 14, 15, 75, 83, 118)
// ---------------------------------------------------------------------------
// เบราว์เซอร์คุยกับ GOG เท่านั้น ไม่เคยเห็น API key และไม่เคยเห็น payload ดิบ
//   ผู้ให้บริการ → เซิร์ฟเวอร์ GOG → normalize → D1 → GOG API → หน้าเว็บ
//
// สเปกแนะนำ Supabase/Postgres แต่โปรเจกต์นี้รันบน Cloudflare Workers + D1 อยู่แล้ว
// จึงใช้ D1 ต่อ สคีมาออกแบบให้ย้ายไป Postgres ทีหลังได้โดยไม่ต้องแก้ตรรกะ

import type { RuntimeEnv } from "@/lib/server/database";
import { createProviders, tryProviders, type AttemptLog } from "@/services/football/providers/router";
import { getMatchCapabilities } from "@/services/football/capabilities";
import type {
  GOGEvent, GOGFixture, GOGHeadToHead, GOGLineup, GOGMatchBundle, GOGStanding, GOGTeamStats,
} from "@/services/football/types";

/** อายุแคชของแต่ละชนิดข้อมูล หน่วยวินาที (STEP 9) — ตั้งเป็นค่าเริ่มต้น ปรับได้ */
export const CACHE_TTL = {
  competition: 7 * 24 * 3_600,
  fixtures: 6 * 3_600,
  fixtureSoon: 2 * 3_600,
  fixtureLive: 60,
  fixtureFinished: 30 * 24 * 3_600,
  standings: 6 * 3_600,
  events: 5 * 60,
  lineups: 15 * 60,
  stats: 5 * 60,
  headToHead: 24 * 3_600,
};

export async function ensureFootballTables(db: D1Database) {
  await db.batch([
    // เก็บ payload ที่ normalize แล้ว ไม่ใช่ของดิบ — ของดิบเก็บแยกไว้ debug (STEP 15)
    db.prepare(`CREATE TABLE IF NOT EXISTS football_cache (
      cache_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS football_provider_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      ok INTEGER NOT NULL,
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`),
    // ตารางแมปเอนทิตีข้ามผู้ให้บริการ (STEP 13) — เติมเมื่อเจอชื่อที่ยังไม่รู้จัก
    db.prepare(`CREATE TABLE IF NOT EXISTS football_entity_map (
      gog_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY (gog_id, provider, entity_type)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_football_cache_expires ON football_cache(expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_football_log_created ON football_provider_log(created_at)"),
  ]);
}

type CacheRow = { payload_json: string; retrieved_at: string; expires_at: string; provider: string };

async function readCache<T>(db: D1Database, key: string): Promise<{ value: T; retrievedAt: string; expired: boolean } | null> {
  const row = await db.prepare("SELECT payload_json, retrieved_at, expires_at, provider FROM football_cache WHERE cache_key = ?")
    .bind(key).first<CacheRow>();
  if (!row) return null;
  try {
    return {
      value: JSON.parse(row.payload_json) as T,
      retrievedAt: row.retrieved_at,
      expired: new Date(row.expires_at).getTime() < Date.now(),
    };
  } catch {
    return null;
  }
}

async function writeCache(db: D1Database, key: string, provider: string, value: unknown, ttlSeconds: number) {
  const now = new Date();
  await db.prepare(`INSERT INTO football_cache (cache_key, provider, payload_json, retrieved_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      provider = excluded.provider, payload_json = excluded.payload_json,
      retrieved_at = excluded.retrieved_at, expires_at = excluded.expires_at`)
    .bind(key, provider, JSON.stringify(value), now.toISOString(),
      new Date(now.getTime() + ttlSeconds * 1_000).toISOString())
    .run();
}

async function logAttempts(db: D1Database, endpoint: string, attempts: AttemptLog[]) {
  if (attempts.length === 0) return;
  const now = new Date().toISOString();
  await db.batch(attempts.map((attempt) =>
    db.prepare("INSERT INTO football_provider_log (provider, endpoint, ok, error, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(attempt.provider, endpoint, attempt.ok ? 1 : 0, attempt.error ?? "", now)));
}

/**
 * อ่านผ่านแคชเสมอ (STEP 9)
 *   แคชยังไม่หมดอายุ → ใช้เลย ไม่ยิงผู้ให้บริการ
 *   หมดอายุ → ยิงใหม่ · ยิงไม่สำเร็จ → คืนของเก่าพร้อมธง stale ไม่ใช่เดาค่าใหม่ (STEP 83)
 */
async function cached<T>(
  env: RuntimeEnv,
  key: string,
  ttlSeconds: number,
  endpoint: string,
  load: () => Promise<{ result: { data: T; provider: string; retrievedAt: string } | null; attempts: AttemptLog[] }>,
): Promise<{ data: T | null; retrievedAt: string | null; stale: boolean; provider: string | null }> {
  const db = env.DB;
  const existing = db ? await readCache<T>(db, key) : null;
  if (existing && !existing.expired) {
    return { data: existing.value, retrievedAt: existing.retrievedAt, stale: false, provider: null };
  }

  const { result, attempts } = await load();
  if (db) await logAttempts(db, endpoint, attempts);

  if (result) {
    if (db) await writeCache(db, key, result.provider, result.data, ttlSeconds);
    return { data: result.data, retrievedAt: result.retrievedAt, stale: false, provider: result.provider };
  }

  if (existing) {
    return { data: existing.value, retrievedAt: existing.retrievedAt, stale: true, provider: null };
  }
  return { data: null, retrievedAt: null, stale: false, provider: null };
}

function providersFor(env: RuntimeEnv) {
  return createProviders({
    apiFootballKey: env.API_FOOTBALL_KEY,
    footballDataKey: env.FOOTBALL_DATA_KEY,
  });
}

/** อายุแคชของแมตช์ขึ้นกับว่าใกล้เตะแค่ไหน — จบแล้วไม่ต้องดึงซ้ำบ่อย (STEP 9) */
function fixtureTtl(fixture: GOGFixture | null) {
  if (!fixture) return CACHE_TTL.fixtures;
  if (fixture.state === "live" || fixture.state === "half_time") return CACHE_TTL.fixtureLive;
  if (fixture.state === "full_time") return CACHE_TTL.fixtureFinished;
  const hoursToKickoff = (new Date(fixture.kickoffUtc).getTime() - Date.now()) / 3_600_000;
  return hoursToKickoff <= 168 ? CACHE_TTL.fixtureSoon : CACHE_TTL.fixtures;
}

export async function getFixtures(env: RuntimeEnv, competition: string, season: string) {
  const set = providersFor(env);
  const key = `fixtures:${competition}:${season}`;
  const loaded = await cached<GOGFixture[]>(env, key, CACHE_TTL.fixtures, "fixtures", () =>
    tryProviders<GOGFixture[]>(set.all, "fixtures", (provider) =>
      provider.getFixtures?.({ competition, season })));
  return { fixtures: loaded.data ?? [], stale: loaded.stale, retrievedAt: loaded.retrievedAt, demo: set.demoMode };
}

export async function getStandings(env: RuntimeEnv, competition: string, season: string) {
  const set = providersFor(env);
  const loaded = await cached<GOGStanding[]>(env, `standings:${competition}:${season}`, CACHE_TTL.standings, "standings", () =>
    tryProviders<GOGStanding[]>(set.all, "standings", (provider) =>
      provider.getStandings?.(competition, season)));
  return { standings: loaded.data ?? [], stale: loaded.stale, demo: set.demoMode };
}

/**
 * ประกอบข้อมูลทั้งหน้าแมตช์
 * ทุกส่วนดึงแยกกันและล้มแยกกันได้ — ไลน์อัพยังไม่ประกาศไม่ควรทำให้ทั้งหน้าพัง (STEP 85)
 */
export async function getMatchBundle(
  env: RuntimeEnv,
  fixtureId: string,
  competition: string,
  season: string,
): Promise<GOGMatchBundle | null> {
  const set = providersFor(env);

  // หาแมตช์จากปฏิทินที่แคชไว้ก่อน — ประหยัดโควตากว่ายิงถามรายตัว
  const calendar = await getFixtures(env, competition, season);
  const fixture = calendar.fixtures.find((item) => item.id === fixtureId);
  if (!fixture) return null;

  const providerFixtureId = fixture.providerIds.api_football
    ?? fixture.providerIds.football_data
    ?? fixture.providerIds.gog_demo
    ?? fixtureId;

  const ttl = fixtureTtl(fixture);
  const [events, lineups, teamStats, headToHead, standings] = await Promise.all([
    cached<GOGEvent[]>(env, `events:${fixtureId}`, Math.min(ttl, CACHE_TTL.events), "events", () =>
      tryProviders<GOGEvent[]>(set.all, "events", (provider) => provider.getEvents?.(providerFixtureId))),
    cached<GOGLineup[]>(env, `lineups:${fixtureId}`, Math.min(ttl, CACHE_TTL.lineups), "lineups", () =>
      tryProviders<GOGLineup[]>(set.all, "lineups", (provider) => provider.getLineups?.(providerFixtureId))),
    cached<GOGTeamStats[]>(env, `stats:${fixtureId}`, Math.min(ttl, CACHE_TTL.stats), "stats", () =>
      tryProviders<GOGTeamStats[]>(set.all, "teamStats", (provider) => provider.getTeamStats?.(providerFixtureId))),
    cached<GOGHeadToHead>(env, `h2h:${fixture.home.id}:${fixture.away.id}`, CACHE_TTL.headToHead, "h2h", () =>
      tryProviders<GOGHeadToHead>(set.all, "headToHead", (provider) =>
        provider.getHeadToHead?.(
          fixture.providerIds.api_football ? fixture.home.providerIds.api_football ?? "" : fixture.home.id,
          fixture.providerIds.api_football ? fixture.away.providerIds.api_football ?? "" : fixture.away.id,
        ))),
    getStandings(env, competition, season),
  ]);

  const bundle: GOGMatchBundle = {
    fixture,
    events: events.data ?? [],
    lineups: lineups.data ?? [],
    teamStats: teamStats.data ?? [],
    headToHead: headToHead.data ?? null,
    standings: standings.standings,
    capabilities: getMatchCapabilities({
      fixture,
      events: events.data ?? [],
      lineups: lineups.data ?? [],
      teamStats: teamStats.data ?? [],
      standings: standings.standings,
      headToHead: headToHead.data ?? null,
    }),
    sync: {
      fixture: calendar.retrievedAt,
      events: events.retrievedAt,
      stats: teamStats.retrievedAt,
      lineups: lineups.retrievedAt,
    },
    demo: set.demoMode,
  };
  return bundle;
}

/** สรุปสุขภาพผู้ให้บริการสำหรับหน้าแอดมิน (STEP 10, 93) */
export async function getProviderHealth(env: RuntimeEnv) {
  const set = providersFor(env);
  if (!env.DB) {
    return { demo: set.demoMode, providers: set.all.map((p) => ({ id: p.id, label: p.label })), today: [] };
  }
  await ensureFootballTables(env.DB);
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const rows = await env.DB.prepare(`SELECT provider, endpoint,
      SUM(ok) AS ok_count, COUNT(*) AS total, MAX(created_at) AS last_call
    FROM football_provider_log WHERE created_at >= ? GROUP BY provider, endpoint`)
    .bind(since).all<{ provider: string; endpoint: string; ok_count: number; total: number; last_call: string }>();
  return {
    demo: set.demoMode,
    providers: set.all.map((provider) => ({ id: provider.id, label: provider.label })),
    today: rows.results ?? [],
  };
}
