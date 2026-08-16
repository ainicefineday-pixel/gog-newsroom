// ปลายทางรับคลิปจาก GROUND CALL
// ---------------------------------------------------------------------------
// GROUND CALL เป็นสตูดิโอคนละเครื่อง (Postgres + FFmpeg + SFU) ส่งคลิปที่ตัดเสร็จ
// แล้วเข้ามาที่นี่ผ่าน HTTP ตัวนี้คือด้านรับของสัญญานั้น ทั้งการยืนยันตัวตน
// การตรวจรูปร่างข้อมูล และกฎซ้ำไม่ได้
//
// กฎที่บังคับไว้ตรงนี้
//   1. ต้องมีคีย์ — ไม่มี GROUND_CALL_INGEST_KEY บน Worker คือปิดปลายทางนี้ทั้งหมด
//   2. ยิงซ้ำด้วย Idempotency-Key เดิมต้องได้ผลเดิม ไม่เกิดคลิปที่สอง
//      (ฝั่งโน้น retry เมื่อเน็ตหลุด ถ้าไม่ล็อกตรงนี้หน้าข่าวจะมีของซ้ำ)
//   3. คลิปที่ยังไม่ถึงเวลาเผยแพร่ (scheduledAt อนาคต) ไม่ขึ้นหน้าเว็บ

import type { RuntimeEnv } from "@/lib/server/database";

export type GroundCallClip = {
  externalId: string;
  sessionId: string;
  clipId: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  matchId: string;
  competition: string;
  mode: string;
  tags: string[];
  hashtags: string[];
  speakerNames: string[];
  transcriptUrl: string | null;
  subtitleUrls: { srt: string | null; vtt: string | null };
  sourceReferences: string[];
  scheduledAt: string | null;
  publishedAt: string;
  status: "PUBLISHED" | "UNPUBLISHED";
};

type ClipRow = {
  external_id: string;
  idempotency_key: string;
  session_id: string;
  clip_id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  video_url: string;
  thumbnail_url: string;
  duration_sec: number;
  match_id: string;
  competition: string;
  mode: string;
  tags_json: string;
  hashtags_json: string;
  speaker_names_json: string;
  transcript_url: string | null;
  subtitle_srt_url: string | null;
  subtitle_vtt_url: string | null;
  source_references_json: string;
  scheduled_at: string | null;
  published_at: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function ensureGroundCallTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS ground_call_clips (
      external_id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL,
      session_id TEXT NOT NULL,
      clip_id TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL DEFAULT '',
      duration_sec INTEGER NOT NULL DEFAULT 0,
      match_id TEXT NOT NULL DEFAULT '',
      competition TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      hashtags_json TEXT NOT NULL DEFAULT '[]',
      speaker_names_json TEXT NOT NULL DEFAULT '[]',
      transcript_url TEXT,
      subtitle_srt_url TEXT,
      subtitle_vtt_url TEXT,
      source_references_json TEXT NOT NULL DEFAULT '[]',
      scheduled_at TEXT,
      published_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PUBLISHED',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_ground_call_clips_idem ON ground_call_clips (idempotency_key)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_ground_call_clips_slug ON ground_call_clips (slug)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_ground_call_clips_published ON ground_call_clips (status, published_at)",
    ),
  ]);
}

/**
 * ตรวจคีย์ของ GROUND CALL
 * ใช้คีย์คนละตัวกับ CRON_SECRET เพราะเป็นคนละระบบ ถอนสิทธิ์ฝั่งสตูดิโอได้
 * โดยไม่ต้องเปลี่ยนความลับของครอนซึ่งใช้กับงานอื่นอยู่
 */
export function groundCallAuthorizationError(request: Request, env: RuntimeEnv) {
  if (!env.GROUND_CALL_INGEST_KEY) {
    return {
      status: 503,
      body: {
        error: "ingest_not_configured",
        message: "ตั้งค่า GROUND_CALL_INGEST_KEY บน Worker ก่อนถึงจะรับคลิปจาก GROUND CALL ได้",
      },
    };
  }
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied !== env.GROUND_CALL_INGEST_KEY) {
    return { status: 401, body: { error: "unauthorized", message: "ต้องส่ง bearer token ของ GROUND CALL มาด้วย" } };
  }
  return null;
}

const SLUG_PATTERN = /^[a-z0-9฀-๿][a-z0-9฀-๿-]{0,120}$/;

function asStringArray(value: unknown, field: string, max = 40): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field} ต้องเป็น array ของ string`);
  return value.slice(0, max).map((entry) => {
    if (typeof entry !== "string") throw new ValidationError(`${field} ต้องเป็น array ของ string`);
    return entry.slice(0, 120);
  });
}

function asHttpUrl(value: unknown, field: string, optional = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (optional) return null;
    throw new ValidationError(`${field} ต้องเป็น URL`);
  }
  if (typeof value !== "string") throw new ValidationError(`${field} ต้องเป็น URL`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError(`${field} ไม่ใช่ URL ที่ใช้ได้`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError(`${field} ต้องเป็น http หรือ https`);
  }
  return parsed.toString();
}

export class ValidationError extends Error {}

/** แปลง payload ดิบให้เป็นคลิปที่เก็บได้ — โยน ValidationError เมื่อรูปร่างไม่ตรงสัญญา */
export function parsePublication(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new ValidationError("ต้องส่ง JSON object");
  const input = raw as Record<string, unknown>;

  const requireText = (field: string, max: number, allowEmpty = false) => {
    const value = input[field];
    if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
      throw new ValidationError(`${field} ต้องเป็นข้อความที่ไม่ว่าง`);
    }
    return value.slice(0, max);
  };

  const slug = requireText("slug", 120).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw new ValidationError("slug ใช้ได้เฉพาะ a-z 0-9 ไทย และ -");

  const durationSec = Number(input.durationSec);
  if (!Number.isInteger(durationSec) || durationSec < 1 || durationSec > 3 * 60 * 60) {
    throw new ValidationError("durationSec ต้องเป็นจำนวนเต็มวินาทีที่มากกว่า 0");
  }

  const scheduledAt = input.scheduledAt;
  if (scheduledAt !== undefined && scheduledAt !== null) {
    if (typeof scheduledAt !== "string" || Number.isNaN(Date.parse(scheduledAt))) {
      throw new ValidationError("scheduledAt ต้องเป็นเวลาแบบ ISO 8601 หรือ null");
    }
  }

  const subtitles = (input.subtitleUrls ?? {}) as Record<string, unknown>;

  return {
    sessionId: requireText("sessionId", 80),
    clipId: requireText("clipId", 80),
    title: requireText("title", 300),
    slug,
    summary: typeof input.summary === "string" ? input.summary.slice(0, 400) : "",
    body: typeof input.body === "string" ? input.body.slice(0, 20_000) : "",
    videoUrl: asHttpUrl(input.videoUrl, "videoUrl")!,
    thumbnailUrl: asHttpUrl(input.thumbnailUrl, "thumbnailUrl", true) ?? "",
    durationSec,
    matchId: typeof input.matchId === "string" ? input.matchId.slice(0, 80) : "",
    competition: typeof input.competition === "string" ? input.competition.slice(0, 120) : "",
    mode: typeof input.mode === "string" ? input.mode.slice(0, 40) : "",
    tags: asStringArray(input.tags, "tags"),
    hashtags: asStringArray(input.hashtags, "hashtags"),
    speakerNames: asStringArray(input.speakerNames, "speakerNames", 10),
    transcriptUrl: asHttpUrl(input.transcriptUrl, "transcriptUrl", true),
    subtitleSrtUrl: asHttpUrl(subtitles.srt, "subtitleUrls.srt", true),
    subtitleVttUrl: asHttpUrl(subtitles.vtt, "subtitleUrls.vtt", true),
    sourceReferences: asStringArray(input.sourceReferences, "sourceReferences"),
    scheduledAt: (scheduledAt as string | null | undefined) ?? null,
  };
}

function rowToClip(row: ClipRow): GroundCallClip {
  const parseJson = (value: string): string[] => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
      return [];
    }
  };
  return {
    externalId: row.external_id,
    sessionId: row.session_id,
    clipId: row.clip_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    durationSec: row.duration_sec,
    matchId: row.match_id,
    competition: row.competition,
    mode: row.mode,
    tags: parseJson(row.tags_json),
    hashtags: parseJson(row.hashtags_json),
    speakerNames: parseJson(row.speaker_names_json),
    transcriptUrl: row.transcript_url,
    subtitleUrls: { srt: row.subtitle_srt_url, vtt: row.subtitle_vtt_url },
    sourceReferences: parseJson(row.source_references_json),
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    status: row.status === "UNPUBLISHED" ? "UNPUBLISHED" : "PUBLISHED",
  };
}

/**
 * รับคลิปเข้าคลัง
 * คืน replayed = true เมื่อเป็นการยิงซ้ำด้วยกุญแจเดิม ฝั่งสตูดิโอเอาไปแยกได้ว่า
 * ครั้งนี้สร้างของใหม่หรือได้ของเดิมกลับไป
 */
export async function ingestGroundCallClip(
  env: RuntimeEnv,
  payload: ReturnType<typeof parsePublication>,
  idempotencyKey: string,
): Promise<{ clip: GroundCallClip; replayed: boolean }> {
  const db = env.DB!;
  await ensureGroundCallTables(db);

  const existing = await db
    .prepare("SELECT * FROM ground_call_clips WHERE idempotency_key = ?")
    .bind(idempotencyKey)
    .first<ClipRow>();
  if (existing) return { clip: rowToClip(existing), replayed: true };

  // สองเซสชันที่ตั้งชื่อชนกันไม่ควรทับของกันเอง เติมท้ายให้ต่างแทนการปฏิเสธ
  // เพราะบรรณาธิการฝั่งโน้นกดเผยแพร่ไปแล้ว การตีกลับตรงนี้คือคลิปหาย
  const slugTaken = await db
    .prepare("SELECT slug FROM ground_call_clips WHERE slug = ?")
    .bind(payload.slug)
    .first<{ slug: string }>();
  const slug = slugTaken ? `${payload.slug}-${payload.clipId.slice(-6).toLowerCase()}` : payload.slug;

  const now = new Date().toISOString();
  const externalId = `gcc_${payload.sessionId.slice(-8)}_${payload.clipId.slice(-8)}`;
  // เวลาที่ตั้งไว้ล่วงหน้าคือเวลาเผยแพร่จริง ไม่ใช่เวลาที่ยิงเข้ามา
  const publishedAt = payload.scheduledAt ?? now;

  await db
    .prepare(
      `INSERT INTO ground_call_clips (
        external_id, idempotency_key, session_id, clip_id, title, slug, summary, body,
        video_url, thumbnail_url, duration_sec, match_id, competition, mode,
        tags_json, hashtags_json, speaker_names_json, transcript_url,
        subtitle_srt_url, subtitle_vtt_url, source_references_json,
        scheduled_at, published_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?)
      ON CONFLICT(external_id) DO UPDATE SET
        title = excluded.title, summary = excluded.summary, body = excluded.body,
        video_url = excluded.video_url, thumbnail_url = excluded.thumbnail_url,
        duration_sec = excluded.duration_sec, tags_json = excluded.tags_json,
        hashtags_json = excluded.hashtags_json, speaker_names_json = excluded.speaker_names_json,
        transcript_url = excluded.transcript_url, subtitle_srt_url = excluded.subtitle_srt_url,
        subtitle_vtt_url = excluded.subtitle_vtt_url, source_references_json = excluded.source_references_json,
        scheduled_at = excluded.scheduled_at, published_at = excluded.published_at,
        idempotency_key = excluded.idempotency_key, status = 'PUBLISHED', updated_at = excluded.updated_at`,
    )
    .bind(
      externalId, idempotencyKey, payload.sessionId, payload.clipId, payload.title, slug,
      payload.summary, payload.body, payload.videoUrl, payload.thumbnailUrl, payload.durationSec,
      payload.matchId, payload.competition, payload.mode,
      JSON.stringify(payload.tags), JSON.stringify(payload.hashtags), JSON.stringify(payload.speakerNames),
      payload.transcriptUrl, payload.subtitleSrtUrl, payload.subtitleVttUrl,
      JSON.stringify(payload.sourceReferences), payload.scheduledAt, publishedAt, now, now,
    )
    .run();

  const stored = await db
    .prepare("SELECT * FROM ground_call_clips WHERE external_id = ?")
    .bind(externalId)
    .first<ClipRow>();
  if (!stored) throw new Error("บันทึกคลิปแล้วแต่อ่านกลับไม่ได้");
  return { clip: rowToClip(stored), replayed: false };
}

/** คลิปที่ขึ้นหน้าเว็บได้ — ตัดของที่ถอนแล้วและของที่ยังไม่ถึงเวลาออก */
export async function listGroundCallClips(env: RuntimeEnv, limit = 20): Promise<GroundCallClip[]> {
  if (!env.DB) return [];
  await ensureGroundCallTables(env.DB);
  const now = new Date().toISOString();
  const rows = (await env.DB
    .prepare(
      `SELECT * FROM ground_call_clips
       WHERE status = 'PUBLISHED' AND published_at <= ?
       ORDER BY published_at DESC LIMIT ?`,
    )
    .bind(now, Math.min(Math.max(limit, 1), 50))
    .all<ClipRow>()).results ?? [];
  return rows.map(rowToClip);
}

export async function getGroundCallClip(env: RuntimeEnv, slug: string): Promise<GroundCallClip | null> {
  if (!env.DB) return null;
  await ensureGroundCallTables(env.DB);
  const row = await env.DB
    .prepare("SELECT * FROM ground_call_clips WHERE slug = ? AND status = 'PUBLISHED'")
    .bind(slug)
    .first<ClipRow>();
  return row ? rowToClip(row) : null;
}

/**
 * ถอนคลิปออกจากหน้าเว็บ
 * ไม่ลบแถวทิ้ง เพราะกุญแจกันซ้ำต้องอยู่ต่อ ไม่งั้นการ retry ของฝั่งสตูดิโอ
 * หลังถอนจะทำให้คลิปที่เพิ่งถอนกลับขึ้นมาเอง
 */
export async function unpublishGroundCallClip(env: RuntimeEnv, externalId: string) {
  const result = await env.DB!
    .prepare("UPDATE ground_call_clips SET status = 'UNPUBLISHED', updated_at = ? WHERE external_id = ?")
    .bind(new Date().toISOString(), externalId)
    .run();
  const changes = Number(result.meta?.changes ?? 0);
  return { removed: changes > 0 };
}
