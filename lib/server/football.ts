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
import type { ProviderFetchResult } from "@/services/football/providers/types";
import { providerCompetitionCode } from "@/services/football/competitions";
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
    // ประวัติการเปลี่ยนแปลงตารางแข่ง (STEP 67)
    // พรีเมียร์ลีกเลื่อนวัน เปลี่ยนเวลา และย้ายสนามตามการถ่ายทอดสดอยู่เรื่อย
    // คนที่จองตั๋วเครื่องบินไปแล้วต้องรู้ก่อนใคร เพราะตั๋วส่วนใหญ่คืนเงินไม่ได้
    db.prepare(`CREATE TABLE IF NOT EXISTS football_fixture_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      detected_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_football_cache_expires ON football_cache(expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_football_log_created ON football_provider_log(created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_fixture_changes_fixture ON football_fixture_changes(fixture_id, detected_at)"),
  ]);
}

/** ชนิดการเปลี่ยนแปลงที่ผู้ใช้ต้องรู้จริง ๆ — ไม่เก็บทุกฟิลด์เพราะจะกลายเป็นขยะ */
export type FixtureChange = {
  fixtureId: string;
  field: "kickoff" | "venue" | "status";
  oldValue: string;
  newValue: string;
  detectedAt: string;
};

/**
 * เทียบปฏิทินชุดเก่ากับชุดใหม่แล้วคืนเฉพาะสิ่งที่เปลี่ยนจริง
 * เทียบด้วย gogFixtureId ซึ่งประกอบจากคู่ทีม + วันเตะ
 * แปลว่าถ้า "เลื่อนวัน" id จะเปลี่ยนไปด้วย จึงต้องจับคู่ด้วยคู่ทีมอีกชั้นหนึ่ง
 * ไม่งั้นการเลื่อนวันจะดูเหมือนแมตช์เก่าหายไปแล้วมีแมตช์ใหม่โผล่มาแทน
 */
export function diffFixtures(previous: GOGFixture[], next: GOGFixture[]): FixtureChange[] {
  const pairKey = (fixture: GOGFixture) => `${fixture.home.id}|${fixture.away.id}`;
  const before = new Map(previous.map((fixture) => [pairKey(fixture), fixture]));
  const detectedAt = new Date().toISOString();
  const changes: FixtureChange[] = [];

  for (const fixture of next) {
    const old = before.get(pairKey(fixture));
    if (!old) continue;

    if (old.kickoffUtc !== fixture.kickoffUtc) {
      changes.push({
        fixtureId: fixture.id, field: "kickoff",
        oldValue: old.kickoffUtc, newValue: fixture.kickoffUtc, detectedAt,
      });
    }
    const oldVenue = old.venue?.name ?? "";
    const newVenue = fixture.venue?.name ?? "";
    // สนามว่างเปล่ากลายเป็นมีชื่อ = ผู้ให้บริการเพิ่งเติมข้อมูล ไม่ใช่ย้ายสนาม
    if (oldVenue && newVenue && oldVenue !== newVenue) {
      changes.push({ fixtureId: fixture.id, field: "venue", oldValue: oldVenue, newValue: newVenue, detectedAt });
    }
    if (old.state !== fixture.state && (fixture.state === "postponed" || fixture.state === "cancelled")) {
      changes.push({ fixtureId: fixture.id, field: "status", oldValue: old.state, newValue: fixture.state, detectedAt });
    }
  }
  return changes;
}

async function recordFixtureChanges(db: D1Database, changes: FixtureChange[]) {
  if (changes.length === 0) return;
  await db.batch(changes.map((change) =>
    db.prepare(`INSERT INTO football_fixture_changes (fixture_id, field, old_value, new_value, detected_at)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(change.fixtureId, change.field, change.oldValue, change.newValue, change.detectedAt)));
}

/** การเปลี่ยนแปลงล่าสุด — ใช้ติดป้ายบนการ์ดแมตช์และหน้าแมตช์ */
export async function listFixtureChanges(env: RuntimeEnv, days = 30): Promise<FixtureChange[]> {
  if (!env.DB) return [];
  await ensureFootballTables(env.DB);
  const since = new Date(Date.now() - days * 24 * 3_600_000).toISOString();
  const rows = await env.DB.prepare(`SELECT fixture_id, field, old_value, new_value, detected_at
    FROM football_fixture_changes WHERE detected_at >= ? ORDER BY id DESC LIMIT 200`)
    .bind(since)
    .all<{ fixture_id: string; field: string; old_value: string; new_value: string; detected_at: string }>();
  return (rows.results ?? []).map((row) => ({
    fixtureId: row.fixture_id,
    field: row.field as FixtureChange["field"],
    oldValue: row.old_value,
    newValue: row.new_value,
    detectedAt: row.detected_at,
  }));
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

/**
 * ดึงปฏิทินจากผู้ให้บริการ "ทุกเจ้าที่ตั้งค่าไว้" แล้วรวม id ของแต่ละเจ้าเข้ากับแมตช์เดียวกัน
 * ผ่าน gogFixtureId (คู่ทีม + วันเตะ) ซึ่งเป็นการสร้าง provider entity map ตาม STEP 13
 *
 * ย้ำว่านี่ไม่ใช่การเอาค่ามาผสมกันแบบที่ STEP 7 ห้าม — ค่าของแมตช์ (สกอร์ เวลา สนาม)
 * ยังมาจากเจ้าที่ลำดับสูงสุดเจ้าเดียว รวมเฉพาะ "รหัสอ้างอิง" เท่านั้น
 *
 * จำเป็นต้องทำ เพราะถ้าไม่มี id ของเจ้าไหน แล้วเอา id ของอีกเจ้าไปยิงถาม
 * จะได้ข้อมูลของ "คนละแมตช์" กลับมาโดยไม่มีอะไรเตือนเลย
 */
export async function getFixtures(env: RuntimeEnv, competitionId: string, season: string) {
  const set = providersFor(env);
  const key = `fixtures:${competitionId}:${season}`;
  // อ่านชุดเดิมไว้ก่อน เพื่อเทียบหาการเปลี่ยนแปลงหลังดึงชุดใหม่ (STEP 67)
  const previous = env.DB ? await readCache<GOGFixture[]>(env.DB, key) : null;

  const loaded = await cached<GOGFixture[]>(env, key, CACHE_TTL.fixtures, "fixtures", async () => {
    const attempts: AttemptLog[] = [];
    const collected: Array<{ provider: string; fixtures: GOGFixture[] }> = [];

    for (const provider of set.all) {
      if (!provider.capabilities.fixtures || !provider.getFixtures) continue;
      const code = providerCompetitionCode(competitionId, provider.id);
      if (!code) continue;
      try {
        const result = await provider.getFixtures({ competition: code, season });
        collected.push({ provider: provider.id, fixtures: result.data });
        attempts.push({ provider: provider.id, ok: true });
      } catch (error) {
        attempts.push({
          provider: provider.id,
          ok: false,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    if (collected.length === 0) return { result: null, attempts };

    // เจ้าแรกที่สำเร็จเป็นเจ้าของค่าทั้งหมด เจ้าที่เหลือมาเติมแค่รหัสอ้างอิง
    const [primary, ...rest] = collected;
    const merged = new Map(primary.fixtures.map((fixture) => [fixture.id, fixture]));

    for (const extra of rest) {
      for (const fixture of extra.fixtures) {
        const existing = merged.get(fixture.id);
        if (existing) {
          existing.providerIds = { ...existing.providerIds, ...fixture.providerIds };
          existing.home.providerIds = { ...existing.home.providerIds, ...fixture.home.providerIds };
          existing.away.providerIds = { ...existing.away.providerIds, ...fixture.away.providerIds };
          // เติมสนามให้เมื่อเจ้าหลักไม่ได้ส่งมา — เป็นการเติมช่องว่าง ไม่ใช่ทับค่าที่มีอยู่
          if (!existing.venue && fixture.venue) existing.venue = fixture.venue;
        } else {
          merged.set(fixture.id, fixture);
        }
      }
    }

    return {
      result: {
        data: [...merged.values()].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc)),
        provider: primary.provider,
        retrievedAt: new Date().toISOString(),
      },
      attempts,
    };
  });

  // provider ไม่เป็น null = เพิ่งดึงมาใหม่จริง ๆ ไม่ใช่อ่านจากแคช จึงค่อยเทียบ
  if (env.DB && loaded.provider && previous && loaded.data) {
    const changes = diffFixtures(previous.value, loaded.data);
    await recordFixtureChanges(env.DB, changes);
  }

  return { fixtures: loaded.data ?? [], stale: loaded.stale, retrievedAt: loaded.retrievedAt, demo: set.demoMode };
}

export async function getStandings(env: RuntimeEnv, competitionId: string, season: string) {
  const set = providersFor(env);
  const loaded = await cached<GOGStanding[]>(env, `standings:${competitionId}:${season}`, CACHE_TTL.standings, "standings", () =>
    tryProviders<GOGStanding[]>(set.all, "standings", (provider) => {
      const code = providerCompetitionCode(competitionId, provider.id);
      if (!code) return undefined;
      return provider.getStandings?.(code, season);
    }));
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

  const ttl = fixtureTtl(fixture);

  /**
   * ยิงถามได้เฉพาะเจ้าที่มี id ของแมตช์นี้จริง ๆ เท่านั้น
   * ก่อนหน้านี้ใช้ id ของเจ้าไหนก็ได้ที่หาเจอ ทำให้เอา id ของ football-data.org
   * ไปถาม API-Football แล้วได้เหตุการณ์ของคนละแมตช์กลับมาโดยไม่มีอะไรเตือน
   */
  const withOwnId = <T>(
    capability: "events" | "lineups" | "teamStats",
    call: (provider: (typeof set.all)[number], providerFixtureId: string) => Promise<ProviderFetchResult<T>> | undefined,
  ) => tryProviders<T>(set.all, capability, (provider) => {
    const providerFixtureId = fixture.providerIds[provider.id];
    if (!providerFixtureId) return undefined;
    return call(provider, providerFixtureId);
  });

  const [events, lineups, teamStats, headToHead, standings] = await Promise.all([
    cached<GOGEvent[]>(env, `events:${fixtureId}`, Math.min(ttl, CACHE_TTL.events), "events", () =>
      withOwnId<GOGEvent[]>("events", (provider, id) => provider.getEvents?.(id))),
    cached<GOGLineup[]>(env, `lineups:${fixtureId}`, Math.min(ttl, CACHE_TTL.lineups), "lineups", () =>
      withOwnId<GOGLineup[]>("lineups", (provider, id) => provider.getLineups?.(id))),
    cached<GOGTeamStats[]>(env, `stats:${fixtureId}`, Math.min(ttl, CACHE_TTL.stats), "stats", () =>
      withOwnId<GOGTeamStats[]>("teamStats", (provider, id) => provider.getTeamStats?.(id))),
    // H2H ใช้ id ของ "ทีม" ไม่ใช่ของแมตช์ จึงต้องมี id ทีมของเจ้านั้นครบทั้งสองฝั่ง
    cached<GOGHeadToHead>(env, `h2h:${fixture.home.id}:${fixture.away.id}`, CACHE_TTL.headToHead, "h2h", () =>
      tryProviders<GOGHeadToHead>(set.all, "headToHead", (provider) => {
        const homeId = fixture.home.providerIds[provider.id];
        const awayId = fixture.away.providerIds[provider.id];
        if (!homeId || !awayId) return undefined;
        return provider.getHeadToHead?.(homeId, awayId);
      })),
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
