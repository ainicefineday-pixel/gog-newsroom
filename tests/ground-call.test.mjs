// ปลายทางรับคลิปจาก GROUND CALL
// ---------------------------------------------------------------------------
// ตรวจสองเรื่องที่พังแล้วเจ็บ
//   1. รูปร่างข้อมูลที่ไม่ตรงสัญญาต้องถูกปฏิเสธก่อนแตะฐานข้อมูล
//   2. ยิงซ้ำด้วยกุญแจเดิมต้องได้คลิปเดิม ไม่ใช่คลิปที่สองบนหน้าข่าว
//
// D1 ปลอมในไฟล์นี้รู้จักเฉพาะคำสั่งที่โค้ดตัวจริงใช้ ไม่ใช่ SQL engine

import assert from "node:assert/strict";
import test from "node:test";
import { ingestGroundCallClip, parsePublication, ValidationError } from "../lib/server/ground-call.ts";

const VALID = {
  sessionId: "ses_01",
  clipId: "clip_01",
  title: "อั้ม–โย่ ถอดบทเรียนเกมเมื่อคืน",
  slug: "aum-yo-post-match",
  summary: "สามประเด็นจากเกมหลังบ้าน",
  body: "เนื้อหาเต็มของคลิป",
  videoUrl: "https://cdn.example.com/clip.mp4",
  thumbnailUrl: "https://cdn.example.com/clip.jpg",
  durationSec: 60,
  matchId: "match_9",
  competition: "Premier League",
  mode: "POST_MATCH",
  tags: ["post-match"],
  hashtags: ["#GOG"],
  speakerNames: ["อั้ม", "โย่"],
  transcriptUrl: null,
  subtitleUrls: { srt: null, vtt: "https://cdn.example.com/clip.vtt" },
  sourceReferences: ["https://example.com/report"],
  scheduledAt: null,
};

function fakeD1() {
  const rows = [];
  const run = (sql, args) => {
    if (/^INSERT INTO ground_call_clips/i.test(sql)) {
      const [external_id, idempotency_key, session_id, clip_id, title, slug, summary, body,
        video_url, thumbnail_url, duration_sec, match_id, competition, mode,
        tags_json, hashtags_json, speaker_names_json, transcript_url,
        subtitle_srt_url, subtitle_vtt_url, source_references_json,
        scheduled_at, published_at, created_at, updated_at] = args;
      const existing = rows.find((row) => row.external_id === external_id);
      const record = {
        external_id, idempotency_key, session_id, clip_id, title, slug, summary, body,
        video_url, thumbnail_url, duration_sec, match_id, competition, mode,
        tags_json, hashtags_json, speaker_names_json, transcript_url,
        subtitle_srt_url, subtitle_vtt_url, source_references_json,
        scheduled_at, published_at, status: "PUBLISHED", created_at, updated_at,
      };
      if (existing) Object.assign(existing, record);
      else rows.push(record);
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  };

  const first = (sql, args) => {
    if (/WHERE idempotency_key = \?/.test(sql)) return rows.find((row) => row.idempotency_key === args[0]) ?? null;
    if (/WHERE slug = \?/.test(sql)) return rows.find((row) => row.slug === args[0]) ?? null;
    if (/WHERE external_id = \?/.test(sql)) return rows.find((row) => row.external_id === args[0]) ?? null;
    return null;
  };

  const statement = (sql) => ({
    bind: (...args) => ({
      first: async () => first(sql, args),
      run: async () => run(sql, args),
      all: async () => ({ results: rows }),
    }),
    first: async () => first(sql, []),
    run: async () => run(sql, []),
    all: async () => ({ results: rows }),
  });

  return { prepare: statement, batch: async () => [], rows };
}

test("payload ที่ตรงสัญญาผ่าน และค่าที่ไม่ส่งมาได้ค่าตั้งต้น", () => {
  const parsed = parsePublication({ ...VALID, tags: undefined, hashtags: undefined });
  assert.equal(parsed.slug, "aum-yo-post-match");
  assert.equal(parsed.durationSec, 60);
  assert.deepEqual(parsed.tags, []);
  assert.equal(parsed.subtitleVttUrl, "https://cdn.example.com/clip.vtt");
});

test("ปฏิเสธ payload ที่ผิดรูปก่อนถึงฐานข้อมูล", () => {
  const rejects = [
    [{ ...VALID, videoUrl: "javascript:alert(1)" }, "ลิงก์วิดีโอที่ไม่ใช่ http"],
    [{ ...VALID, videoUrl: "not-a-url" }, "ข้อความที่ไม่ใช่ URL"],
    [{ ...VALID, slug: "ช่องว่าง ไม่ได้" }, "slug ที่มีช่องว่าง"],
    [{ ...VALID, durationSec: 0 }, "ความยาวศูนย์วินาที"],
    [{ ...VALID, durationSec: 12.5 }, "ความยาวที่ไม่ใช่จำนวนเต็ม"],
    [{ ...VALID, title: "   " }, "หัวข้อว่าง"],
    [{ ...VALID, scheduledAt: "พรุ่งนี้" }, "เวลาที่ไม่ใช่ ISO"],
    [{ ...VALID, speakerNames: [42] }, "ชื่อผู้พูดที่ไม่ใช่ string"],
    ["ไม่ใช่ object", "payload ที่ไม่ใช่ JSON object"],
  ];
  for (const [payload, why] of rejects) {
    assert.throws(() => parsePublication(payload), ValidationError, `ต้องปฏิเสธ${why}`);
  }
});

test("ยิงซ้ำด้วยกุญแจเดิมได้คลิปเดิม ไม่เกิดคลิปที่สอง", async () => {
  const env = { DB: fakeD1() };
  const payload = parsePublication(VALID);

  const first = await ingestGroundCallClip(env, payload, "idem-1");
  assert.equal(first.replayed, false);
  assert.equal(first.clip.slug, "aum-yo-post-match");
  assert.equal(first.clip.status, "PUBLISHED");
  assert.deepEqual(first.clip.speakerNames, ["อั้ม", "โย่"]);

  const again = await ingestGroundCallClip(env, payload, "idem-1");
  assert.equal(again.replayed, true);
  assert.equal(again.clip.externalId, first.clip.externalId);
  assert.equal(env.DB.rows.length, 1);
});

test("คลิปคนละตัวที่ตั้ง slug ชนกัน ไม่ทับของเดิม", async () => {
  const env = { DB: fakeD1() };
  await ingestGroundCallClip(env, parsePublication(VALID), "idem-1");
  const second = await ingestGroundCallClip(
    env,
    parsePublication({ ...VALID, sessionId: "ses_02", clipId: "clip_022222" }),
    "idem-2",
  );
  assert.equal(env.DB.rows.length, 2);
  assert.notEqual(second.clip.slug, "aum-yo-post-match");
  assert.ok(second.clip.slug.startsWith("aum-yo-post-match-"));
});

test("ตั้งเวลาไว้ล่วงหน้า เวลาเผยแพร่คือเวลาที่ตั้ง ไม่ใช่เวลาที่ยิงเข้ามา", async () => {
  const env = { DB: fakeD1() };
  const scheduledAt = new Date(Date.now() + 3_600_000).toISOString();
  const result = await ingestGroundCallClip(env, parsePublication({ ...VALID, scheduledAt }), "idem-3");
  assert.equal(result.clip.publishedAt, scheduledAt);
});
