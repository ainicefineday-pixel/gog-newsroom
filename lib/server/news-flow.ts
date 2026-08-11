// ข้อมูลสำหรับผังสายข่าว
// ---------------------------------------------------------------------------
// ผังนี้ต้องบอกว่า "ระบบทำงานอะไรอยู่" ไม่ใช่รูปภาพที่มีลำแสงวิ่งสวย ๆ
// ทุกตัวเลขที่ส่งออกไปต้องตรวจย้อนกลับไปที่ตารางจริงได้
//   source_runs        → แหล่งไหนส่งมาเท่าไหร่ ผ่านเกณฑ์เท่าไหร่ ล่มหรือเปล่า
//   ingest_runs        → ด่านคัด ดึงมา → ตรงกับแมนยู → เก็บเข้าคลัง
//   story_source_events → จังหวะข่าวเข้าราย ชม. ย้อนหลัง 24 ชม.
//   stories            → พาดหัวล่าสุดของแต่ละแหล่ง และข่าวที่ยังไม่ยืนยัน

import { listStories, type RuntimeEnv } from "@/lib/server/database";
import { NEWS_SOURCE_DIRECTORY } from "@/config/news-sources";

/** โหนดในผังกับชื่อแหล่งที่ใช้จับคู่ — ต้องเรียงจากชื่อยาวไปสั้น ไม่งั้น
    "Manchester Evening News" จะไปโดน "Manchester" ของโหนดอื่นก่อน */
const NODE_LABELS: Array<[string, string]> = [
  ["men", "Manchester Evening News"],
  ["athletic", "The Athletic"],
  ["telegraph", "The Telegraph"],
  ["skysports", "Sky Sports"],
  ["bbc", "BBC Sport"],
];

/** กี่ชั่วโมงที่ไม่มีข่าวเข้าเลยถึงจะถือว่าแหล่งนั้นน่าสงสัย */
const QUIET_HOURS = 12;

export type FlowSourceState = {
  id: string;
  label: string;
  /** ok = ดึงได้ปกติ · quiet = ดึงได้แต่ไม่มีข่าวเข้านาน · down = ดึงไม่ได้ */
  health: "ok" | "quiet" | "down" | "unknown";
  error: string;
  /** รอบล่าสุดดึงมาได้กี่ชิ้น และผ่านเกณฑ์แมนยูกี่ชิ้น */
  fetched: number;
  matched: number;
  /** ข่าวในคลังที่มีแหล่งนี้เป็นต้นทาง ย้อนหลัง 24 ชม. */
  storedRecently: number;
  /** ชั่วโมงตั้งแต่ข่าวชิ้นล่าสุดของแหล่งนี้ — null คือไม่เคยมีเลย */
  hoursSinceLast: number | null;
  /** พาดหัวล่าสุดของแหล่งนี้ ไว้โชว์ตอนเอาเมาส์ชี้เส้น */
  latestHeadline: string;
};

export type NewsFlowData = {
  /** ด่านคัดของรอบล่าสุด */
  stages: { fetched: number; matched: number; stored: number; startedAt: string; finishedAt: string; status: string } | null;
  sources: FlowSourceState[];
  /** ข่าวที่ยังยืนยันข้ามแหล่งไม่ได้ — ทางแยกที่ต้องกล้าโชว์ */
  unverified: { count: number; samples: Array<{ id: string; title: string; source: string }> };
  /**
   * จำนวนข่าวเข้าราย ชม. ย้อนหลัง 24 ชม. (เก่า → ใหม่)
   * bySource แยกว่าชั่วโมงนั้นมาจากแหล่งไหนบ้าง เพื่อให้กดเลือกชั่วโมงแล้ว
   * ผังเปลี่ยนไปแสดงเฉพาะทางที่มีข่าวไหลจริงในชั่วโมงนั้น
   */
  timeline: Array<{ hour: string; count: number; bySource: Record<string, number> }>;
  outputs: { storiesTotal: number; verified: number; translated: number };
};

function hoursBetween(fromIso: string, toMs: number) {
  return (toMs - new Date(fromIso).getTime()) / 3_600_000;
}

export async function getNewsFlow(env: RuntimeEnv, nowMs = Date.now()): Promise<NewsFlowData> {
  const db = env.DB!;

  const run = await db.prepare(`SELECT started_at, finished_at, fetched, matched, stored, status
    FROM ingest_runs ORDER BY id DESC LIMIT 1`)
    .first<{ started_at: string; finished_at: string; fetched: number; matched: number; stored: number; status: string }>();

  // ผลรายแหล่งของ "รอบล่าสุดที่มีข้อมูลรายแหล่ง" ไม่ใช่รอบล่าสุดเสมอไป
  // เพราะรอบก่อนหน้าที่เพิ่งดีพลอยยังไม่ได้เก็บสถิติรายแหล่ง
  const latestSourceRun = await db.prepare("SELECT run_started_at FROM source_runs ORDER BY id DESC LIMIT 1")
    .first<{ run_started_at: string }>();

  const sourceRows = latestSourceRun
    ? (await db.prepare(`SELECT source_id, source_name, ok, fetched, matched, error
        FROM source_runs WHERE run_started_at = ?`)
        .bind(latestSourceRun.run_started_at)
        .all<{ source_id: string; source_name: string; ok: number; fetched: number; matched: number; error: string }>()).results ?? []
    : [];

  const since24h = new Date(nowMs - 24 * 3_600_000).toISOString();
  const eventRows = (await db.prepare(`SELECT source_name, created_at, published_at
    FROM story_source_events WHERE created_at >= ? ORDER BY created_at DESC LIMIT 800`)
    .bind(since24h)
    .all<{ source_name: string; created_at: string; published_at: string }>()).results ?? [];

  // พาดหัวล่าสุดต่อแหล่ง — อ่านจากคลังข่าวโดยตรง เพราะต้องได้ชื่อเรื่องที่คนอ่านเห็นจริง
  const stories = await listStories(db, { days: 3, minCredibility: 0 });

  const byName = new Map<string, { stored: number; lastAt: string | null }>();
  for (const row of eventRows) {
    const entry = byName.get(row.source_name) ?? { stored: 0, lastAt: null };
    entry.stored += 1;
    if (!entry.lastAt || row.created_at > entry.lastAt) entry.lastAt = row.created_at;
    byName.set(row.source_name, entry);
  }

  /** จับชื่อแหล่งในตารางกับโหนดในผัง — X ทุกบัญชีรวมเป็นโหนดเดียว */
  const matchName = (label: string, sourceName: string) =>
    sourceName.toLowerCase().includes(label.toLowerCase())
    || label.toLowerCase().includes(sourceName.toLowerCase());

  /** ชื่อแหล่งที่บันทึกไว้ในตาราง ตกอยู่โหนดไหนของผัง — null คือไม่รู้จัก */
  const nodeIdFor = (sourceName: string): string | null => {
    if (NEWS_SOURCE_DIRECTORY.some((source) => source.kind === "x" && matchName(source.label, sourceName))) return "x";
    const hit = NODE_LABELS.find(([, label]) => matchName(label, sourceName));
    return hit ? hit[0] : null;
  };

  const buildSource = (id: string, label: string, xGroup = false): FlowSourceState => {
    const row = sourceRows.find((entry) => entry.source_id === id);
    let stored = 0;
    let lastAt: string | null = null;
    for (const [name, entry] of byName) {
      const isX = NEWS_SOURCE_DIRECTORY.some((source) => source.kind === "x" && matchName(source.label, name));
      const hit = xGroup ? isX : (!isX && matchName(label, name));
      if (!hit) continue;
      stored += entry.stored;
      if (entry.lastAt && (!lastAt || entry.lastAt > lastAt)) lastAt = entry.lastAt;
    }

    const latest = stories.find((story) => story.sources.some((source) =>
      xGroup ? Boolean(source.handle) : matchName(label, source.name)));

    const hoursSinceLast = lastAt ? hoursBetween(lastAt, nowMs) : null;
    let health: FlowSourceState["health"] = "unknown";
    if (row) health = row.ok ? "ok" : "down";
    if (health === "ok" && (hoursSinceLast === null || hoursSinceLast > QUIET_HOURS)) health = "quiet";

    return {
      id,
      label,
      health,
      error: row?.error ?? "",
      fetched: row?.fetched ?? 0,
      matched: row?.matched ?? 0,
      storedRecently: stored,
      hoursSinceLast: hoursSinceLast === null ? null : Math.round(hoursSinceLast * 10) / 10,
      latestHeadline: latest?.titleTh || latest?.titleEn || "",
    };
  };

  const sources: FlowSourceState[] = [
    buildSource("bbc", "BBC Sport"),
    buildSource("athletic", "The Athletic"),
    buildSource("skysports", "Sky Sports"),
    buildSource("telegraph", "The Telegraph"),
    buildSource("men", "Manchester Evening News"),
    buildSource("x", "X Watchlist", true),
  ];

  // ── จังหวะข่าวเข้าราย ชม. พร้อมแยกว่ามาจากแหล่งไหน ───────────────────
  const buckets = new Map<string, { count: number; bySource: Record<string, number> }>();
  for (let index = 23; index >= 0; index -= 1) {
    const stamp = new Date(nowMs - index * 3_600_000).toISOString().slice(0, 13);
    buckets.set(stamp, { count: 0, bySource: {} });
  }
  for (const row of eventRows) {
    const bucket = buckets.get(row.created_at.slice(0, 13));
    if (!bucket) continue;
    bucket.count += 1;
    const nodeId = nodeIdFor(row.source_name);
    if (nodeId) bucket.bySource[nodeId] = (bucket.bySource[nodeId] ?? 0) + 1;
  }

  const unverifiedStories = stories.filter((story) => !story.verified);

  return {
    stages: run
      ? {
          fetched: run.fetched, matched: run.matched, stored: run.stored,
          startedAt: run.started_at, finishedAt: run.finished_at, status: run.status,
        }
      : null,
    sources,
    unverified: {
      count: unverifiedStories.length,
      samples: unverifiedStories.slice(0, 5).map((story) => ({
        id: story.id,
        title: story.titleTh || story.titleEn,
        source: story.sources[0]?.name ?? "ไม่ระบุแหล่ง",
      })),
    },
    timeline: [...buckets].map(([hour, bucket]) => ({ hour, count: bucket.count, bySource: bucket.bySource })),
    outputs: {
      storiesTotal: stories.length,
      verified: stories.filter((story) => story.verified).length,
      translated: stories.filter((story) => story.translated).length,
    },
  };
}

/** ความคืบหน้าของรอบซิงก์ที่กำลังวิ่ง — null เมื่อไม่มีรอบไหนค้างอยู่ */
export async function getIngestProgress(env: RuntimeEnv) {
  const row = await env.DB!.prepare(`SELECT run_started_at, stage, detail, fetched, matched, stored, done, updated_at
    FROM ingest_progress ORDER BY updated_at DESC LIMIT 1`)
    .first<{
      run_started_at: string; stage: string; detail: string;
      fetched: number; matched: number; stored: number; done: number; updated_at: string;
    }>();
  if (!row) return null;
  return {
    runStartedAt: row.run_started_at,
    stage: row.stage,
    detail: row.detail,
    fetched: row.fetched,
    matched: row.matched,
    stored: row.stored,
    done: row.done === 1,
    updatedAt: row.updated_at,
  };
}
