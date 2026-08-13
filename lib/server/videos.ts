// คลังคลิปของหน้าข่าว
// ---------------------------------------------------------------------------
// เก็บ metadata ที่ดึงมาแล้วไว้ในฐานข้อมูล คนเปิดเว็บจึงไม่ทำให้เกิดการยิงถาม
// YouTube สักครั้งเดียว โควตาจะถูกใช้ตอนเพิ่มคลิปและตอนรีเฟรชสถานะไลฟ์เท่านั้น
//
// คำค้นที่ผูกกับคลิปเอาไปหาข่าวในคลังของเราเอง ไม่ได้ไปดึงจาก Google Trends
// เพราะ Trends ไม่มี API ทางการ ที่คนใช้กันคือ endpoint ภายในซึ่งผิดเงื่อนไขและพังบ่อย
// คลังข่าวของเรามีของจริงที่ตรวจแหล่งแล้ว ใช้ตอบได้ตรงกว่าว่าคลิปนี้เกี่ยวกับข่าวไหน

import { listStories, type RuntimeEnv } from "@/lib/server/database";
import {
  fetchVideoMetadata, findChannelLive, FOOTBALL_GENIUS_CHANNEL_ID, listChannelUploads, pickLive,
  refreshYouTubeLiveStatus, type VideoMetadata, type VideoPlatform,
} from "@/services/video";
import { currentNavMatch, finishedNavMatch, FULL_TIME_MINUTES } from "@/services/football/next-match";
import { TEAM_NAMES, thaiTeamShortName } from "@/services/football/thai";
import { MU_KEYWORDS } from "@/config/mu-keywords";

export type StoredVideo = {
  id: string;
  platform: VideoPlatform;
  videoId: string;
  url: string;
  title: string;
  description: string;
  keywords: string[];
  thumbnail: string;
  channel: string;
  onAirAt: string | null;
  isLive: boolean;
  createdAt: string;
  /** ข่าวในคลังที่คำค้นของคลิปนี้ไปตรงด้วย — พร้อมชื่อสำนักข่าวเสมอ */
  relatedStories: Array<{ id: string; title: string; source: string; url: string }>;
  /** นัดที่คลิปนี้น่าจะเกี่ยวข้อง — ตอนนี้ผูกกับนัดที่แถบ nav กำลังพูดถึง */
  relatedMatch: { home: string; away: string; kickoffUtc: string } | null;
};

type VideoRow = {
  id: string; platform: string; video_id: string; url: string; title: string;
  description: string; keywords: string; thumbnail: string; channel: string;
  on_air_at: string | null; is_live: number; created_at: string;
};

const splitKeywords = (value: string) =>
  value.split(",").map((entry) => entry.trim()).filter(Boolean);

/**
 * ข่าวที่เกี่ยวกับคลิปนี้
 * จับจากคำค้นที่บรรณาธิการใส่ไว้ ไม่ใช่เดาจากทั้งคำอธิบาย เพราะคำอธิบายมีคำทั่วไป
 * เยอะจนไปตรงกับข่าวมั่วไปหมด คำค้นคือสิ่งที่คนเขียนตั้งใจบอกว่าคลิปนี้พูดเรื่องอะไร
 */
function matchStories(
  keywords: string[],
  stories: Awaited<ReturnType<typeof listStories>>,
) {
  if (keywords.length === 0) return [];
  const needles = keywords.map((entry) => entry.toLowerCase());
  return stories
    .filter((story) => {
      const haystack = `${story.titleTh} ${story.titleEn}`.toLowerCase();
      return needles.some((needle) => needle.length >= 3 && haystack.includes(needle));
    })
    .slice(0, 3)
    .map((story) => ({
      id: story.id,
      title: story.titleTh || story.titleEn,
      source: story.sources[0]?.name ?? "ไม่ระบุแหล่ง",
      url: story.sources[0]?.url ?? "",
    }));
}

export async function listVideos(env: RuntimeEnv): Promise<StoredVideo[]> {
  const rows = (await env.DB!.prepare(
    "SELECT * FROM videos ORDER BY is_live DESC, COALESCE(on_air_at, created_at) DESC LIMIT 40",
  ).all<VideoRow>()).results ?? [];
  if (rows.length === 0) return [];

  // อ่านข่าวชุดเดียวแล้วเอาไปจับกับทุกคลิป ไม่ใช่ query ต่อคลิป
  let stories: Awaited<ReturnType<typeof listStories>> = [];
  try {
    stories = await listStories(env.DB!, { days: 7, minCredibility: 0 });
  } catch {
    stories = [];
  }
  const match = currentNavMatch();

  return rows.map((row) => {
    const keywords = splitKeywords(row.keywords);
    return {
      id: row.id,
      platform: row.platform as VideoPlatform,
      videoId: row.video_id,
      url: row.url,
      title: row.title,
      description: row.description,
      keywords,
      thumbnail: row.thumbnail,
      channel: row.channel,
      onAirAt: row.on_air_at,
      isLive: row.is_live === 1,
      createdAt: row.created_at,
      relatedStories: matchStories(keywords, stories),
      relatedMatch: match ? { home: match.home, away: match.away, kickoffUtc: match.kickoffUtc } : null,
    };
  });
}

export type AddVideoInput = {
  url: string;
  /** ใส่มาแล้วใช้ของที่ใส่ ไม่ใส่ก็ใช้ของที่ดึงมาจากแพลตฟอร์ม */
  title?: string;
  description?: string;
  keywords?: string;
  onAirAt?: string;
};

export async function addVideo(env: RuntimeEnv, input: AddVideoInput) {
  const meta = await fetchVideoMetadata(input.url, env.YOUTUBE_API_KEY);
  const id = await saveVideo(env, meta, input);
  // ใส่กลับมาเองแปลว่าเปลี่ยนใจแล้ว ลบหมายเหตุที่เคยเอาออกทิ้ง
  // ไม่งั้นครอนรอบหน้าจะยังคิดว่าคลิปนี้ถูกปฏิเสธไว้และไม่ยอมอัปเดตให้
  await env.DB!.prepare("DELETE FROM video_dismissals WHERE id = ?").bind(id).run();
  return { id, ...meta };
}

/** เขียนคลิปลงคลัง — แยกออกมาเพราะฝั่งครอนมี metadata อยู่แล้ว ไม่ต้องยิงถามซ้ำ */
async function saveVideo(env: RuntimeEnv, meta: VideoMetadata, input: Omit<AddVideoInput, "url"> = {}) {
  const id = `${meta.platform}:${meta.videoId}`;
  const now = new Date().toISOString();

  await env.DB!.prepare(`INSERT INTO videos
      (id, platform, video_id, url, title, description, keywords, thumbnail, channel, on_air_at, is_live, live_checked_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, description = excluded.description, keywords = excluded.keywords,
        thumbnail = excluded.thumbnail, channel = excluded.channel, on_air_at = excluded.on_air_at,
        is_live = excluded.is_live, live_checked_at = excluded.live_checked_at`)
    .bind(
      id, meta.platform, meta.videoId, meta.url,
      (input.title ?? meta.title).slice(0, 300),
      (input.description ?? meta.description).slice(0, 2_000),
      (input.keywords ?? "").slice(0, 400),
      meta.thumbnail, meta.channel,
      input.onAirAt ?? meta.onAirAt, meta.isLive ? 1 : 0, now, now,
    )
    .run();

  return id;
}

/**
 * เอาคลิปออกจากหน้าข่าว
 * บันทึกไว้ด้วยว่าคลิปนี้ถูกเอาออก เพราะครอนดึงคลิปใหม่จากช่องทุกรอบ
 * ถ้าไม่จำไว้ คลิปที่เพิ่งกดลบจะกลับขึ้นหน้าเว็บเองภายในสิบนาที
 */
export async function removeVideo(env: RuntimeEnv, id: string) {
  const result = await env.DB!.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
  await env.DB!.prepare("INSERT OR REPLACE INTO video_dismissals (id, dismissed_at) VALUES (?, ?)")
    .bind(id, new Date().toISOString())
    .run();
  return { removed: result.meta?.changes ?? 0 };
}

/**
 * รีเฟรชป้าย LIVE ของคลิป YouTube ทั้งชุดด้วยการเรียกครั้งเดียว
 * videos.list รับได้ 50 id ต่อครั้งและคิด 1 หน่วยเท่ากับถามคลิปเดียว
 */
export async function refreshVideoLiveStatus(env: RuntimeEnv) {
  if (!env.YOUTUBE_API_KEY) return { checked: 0, live: 0, note: "ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY" };
  const rows = (await env.DB!.prepare(
    "SELECT id, video_id FROM videos WHERE platform = 'youtube' ORDER BY created_at DESC LIMIT 50",
  ).all<{ id: string; video_id: string }>()).results ?? [];
  if (rows.length === 0) return { checked: 0, live: 0, note: "ยังไม่มีคลิป YouTube ในระบบ" };

  let statuses: Map<string, boolean>;
  try {
    statuses = await refreshYouTubeLiveStatus(rows.map((row) => row.video_id), env.YOUTUBE_API_KEY);
  } catch (error) {
    return { checked: 0, live: 0, note: error instanceof Error ? error.message.slice(0, 160) : "เรียก YouTube ไม่สำเร็จ" };
  }

  const now = new Date().toISOString();
  let live = 0;
  const updates = rows.map((row) => {
    const isLive = statuses.get(row.video_id) ?? false;
    if (isLive) live += 1;
    return env.DB!.prepare("UPDATE videos SET is_live = ?, live_checked_at = ? WHERE id = ?")
      .bind(isLive ? 1 : 0, now, row.id);
  });
  await env.DB!.batch(updates);

  return { checked: rows.length, live, note: "" };
}

/** มองย้อนไปกี่คลิปใน playlist อัปโหลด — ช่องลงวันละไม่กี่ตัว หกตัวครอบคลุมสองสามวัน */
const UPLOAD_LOOKBACK = 6;
/** เก่ากว่านี้ไม่ต้องดึงขึ้นเอง — คลิปเก่าเป็นเรื่องของบรรณาธิการที่จะเลือกใส่เอง */
const FRESH_DAYS = 3;
/** กันรอบแรกหลังเปิดใช้งานไม่ให้เทคลิปทั้ง playlist ขึ้นหน้าเว็บทีเดียว */
const MAX_ADDS_PER_RUN = 3;

/**
 * ตั้งคำค้นจากหัวข้อคลิป
 *
 * คำค้นคือสิ่งที่ใช้จับคลิปเข้ากับข่าวในคลัง จึงต้องเป็นคำที่โผล่ในพาดหัวข่าวจริง
 * หัวข้อคลิปของช่องเป็นภาษาไทย ("ผีอุ่นเสมอลีดส์ 1-1") จึงเทียบกับชื่อทีมภาษาไทย
 * ในพจนานุกรมเป็นหลัก แล้วค่อยเสริมด้วยคำอังกฤษสำหรับหัวข้อที่เขียนชื่อฝรั่งไว้
 *
 * ไทยไม่เว้นวรรคระหว่างคำ การหาแบบ substring จึงเป็นวิธีที่ถูกต้องที่นี่
 * ส่วนคำอังกฤษเอาเฉพาะที่ยาวพอ (ตั้งแต่ห้าตัวอักษร) กันไปโดนคำทั่วไปเข้า
 */
export function keywordsFromTitle(title: string) {
  const haystack = title.toLowerCase();
  const found = new Set<string>();

  for (const record of Object.values(TEAM_NAMES)) {
    const written = [record.th, record.short].some((form) => haystack.includes(form.toLowerCase()));
    if (written) found.add(record.short);
  }
  for (const keyword of MU_KEYWORDS) {
    if (keyword.length >= 5 && haystack.includes(keyword)) found.add(keyword);
  }

  return [...found];
}

/**
 * ช่วงเวลาไปดูว่าช่องลงคลิปหลังเกมหรือยัง นับจากเวลาจบเกมของนัดในปฏิทิน
 *
 * ช่องจะขึ้นไลฟ์วิเคราะห์ราว 30–60 นาทีหลังจบเกม เผื่อหน้าเผื่อหลังอีก 30
 * หน้าต่างที่เฝ้าจริงจึงเป็นตั้งแต่จบเกมถึงชั่วโมงครึ่ง
 *
 * ส่วนหางยาวถึงสองชั่วโมงครึ่งเพราะไลฟ์ที่จบแล้วเข้า playlist อัปโหลดช้ากว่าที่คิด
 * นัดกับลีดส์ 12 ส.ค. จบเกม 20:15 UTC ไลฟ์ขึ้น 20:33 แต่คลิปเพิ่งโผล่ใน playlist
 * ตอน 21:49 คือ 94 นาทีหลังจบเกม ถ้าปิดหน้าต่างที่ 90 นาทีก็พลาดคลิปนั้นพอดี
 */
const POST_MATCH_WATCH_MINUTES = 90;
const POST_MATCH_TAIL_MINUTES = 150;
/** ระยะห่างขั้นต่ำระหว่างการยิง search.list ในหน้าต่างเฝ้า — ครอนวิ่งทุก 10 นาที */
const LIVE_SEARCH_EVERY_MINUTES = 30;

/**
 * รอบเฝ้าประจำวันนอกช่วงหลังเกม — ทุก 6 ชั่วโมง (ตี 1, 7 โมง, บ่ายโมง, 1 ทุ่ม UTC)
 * ครอนวิ่งทุก 10 นาที เงื่อนไขนาที < 10 จึงตรงรอบเดียวต่อชั่วโมงนั้น
 * ไว้เก็บคลิปที่ช่องลงตามผังปกติซึ่งไม่ผูกกับนัดไหน ตกวันละ 4 รอบ = 8 หน่วย
 */
function isDailySweep(now: Date) {
  return now.getUTCHours() % 6 === 1 && now.getUTCMinutes() < 10;
}

/**
 * ดึงคลิปใหม่ของช่องขึ้นแถบคลิปให้เอง
 *
 * เดิมตัวนี้รับเฉพาะคลิปที่ "กำลังไลฟ์อยู่ ณ วินาทีที่ครอนวิ่ง" ซึ่งพลาดของจริงเกือบหมด
 * ไลฟ์ที่จบแล้ว YouTube จะเปลี่ยน liveBroadcastContent กลับเป็น none ทันที
 * ไลฟ์ที่เริ่มและจบระหว่างรอบครอน หรือรอบที่ยิงพลาดไป จึงหายไปเลยไม่มีวันกลับมา
 * และคลิปปกติที่ช่องลงตามผังก็ไม่เคยถูกดึงขึ้นเลยสักตัวเพราะไม่ใช่ไลฟ์
 *
 * รอบนี้ดูจาก playlist อัปโหลดของช่องแทน — คลิปใหม่ทุกแบบอยู่ในนั้นหมด
 * ทั้งไลฟ์สด ไลฟ์ที่จบแล้ว และคลิปที่อัดมาลง
 *
 * โควตาต่อวัน 10,000 หน่วย ตัวนี้ใช้:
 *   นอกช่วงหลังเกม  4 รอบ × 2 หน่วย                       =   8
 *   ในช่วงหลังเกม   15 รอบ × 2 หน่วย                      =  30
 *   ยิง search หาไลฟ์ทุกครึ่งชั่วโมงในหน้าต่างเฝ้า 3 ครั้ง × 100 = 300
 * วันที่มีนัดจึงตกราว 340 หน่วย วันที่ไม่มีนัด 8 หน่วย
 */
export async function syncChannelVideos(env: RuntimeEnv, options: { force?: boolean } = {}) {
  const added: string[] = [];
  if (!env.YOUTUBE_API_KEY) return { searched: false, added, note: "ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY" };

  const now = new Date();
  // นัดที่เพิ่งจบเป็นตัวตั้งเวลา ไม่ใช่ currentNavMatch ซึ่งกระโดดไปชี้นัดถัดไปตั้งแต่นาทีที่ 120
  const match = finishedNavMatch(POST_MATCH_TAIL_MINUTES, now.getTime());
  const sinceFullTime = match
    ? (now.getTime() - new Date(match.kickoffUtc).getTime()) / 60_000 - FULL_TIME_MINUTES
    : Number.NaN;
  const watching = Number.isFinite(sinceFullTime) && sinceFullTime <= POST_MATCH_WATCH_MINUTES;

  // ไม่ใช่ช่วงหลังเกมและไม่ใช่รอบกวาดประจำวัน = ไม่ต้องไปกวน YouTube เลยสักหน่วย
  // ยกเว้นแอดมินสั่งเอง ซึ่งเป็นการกดครั้งเดียวไม่ใช่ทุกสิบนาที
  if (!options.force && !match && !isDailySweep(now)) {
    return { searched: false, added, note: "ยังไม่ถึงช่วงหลังเกมและยังไม่ถึงรอบกวาดประจำวัน" };
  }

  const uploads = await listChannelUploads(FOOTBALL_GENIUS_CHANNEL_ID, env.YOUTUBE_API_KEY, UPLOAD_LOOKBACK)
    .catch(() => [] as VideoMetadata[]);

  // ไลฟ์ที่เพิ่งกดเริ่มยังไม่ทันเข้า playlist — ในหน้าต่างเฝ้ายอมจ่าย 100 หน่วยเพื่อความไว
  // แต่ยิงห่างกันครึ่งชั่วโมง ไม่ใช่ทุกรอบครอน ไม่งั้นนัดเดียวก็ 900 หน่วยแล้ว
  const searchSlot = watching && sinceFullTime % LIVE_SEARCH_EVERY_MINUTES < 10;
  if (searchSlot && !pickLive(uploads)) {
    const live = await findChannelLive(FOOTBALL_GENIUS_CHANNEL_ID, env.YOUTUBE_API_KEY).catch(() => null);
    if (live && !uploads.some((upload) => upload.videoId === live.videoId)) {
      const meta = await fetchVideoMetadata(`https://www.youtube.com/watch?v=${live.videoId}`, env.YOUTUBE_API_KEY)
        .catch(() => null);
      if (meta) uploads.unshift(meta);
    }
  }
  if (uploads.length === 0) return { searched: true, added, note: "อ่านคลิปของช่องไม่ได้" };

  const known = new Set([
    ...((await env.DB!.prepare("SELECT id FROM videos").all<{ id: string }>()).results ?? []).map((row) => row.id),
    ...((await env.DB!.prepare("SELECT id FROM video_dismissals").all<{ id: string }>()).results ?? []).map((row) => row.id),
  ]);
  const freshBefore = Date.now() - FRESH_DAYS * 86_400_000;

  for (const upload of uploads) {
    if (added.length >= MAX_ADDS_PER_RUN) break;
    const id = `${upload.platform}:${upload.videoId}`;
    if (known.has(id)) continue;
    const onAir = upload.onAirAt ? new Date(upload.onAirAt).getTime() : Number.NaN;
    if (!Number.isFinite(onAir) || onAir < freshBefore) continue;

    // คำค้นมาจากหัวข้อคลิปเป็นหลัก ส่วนคลิปที่ออกอากาศคาบเกี่ยวกับนัดที่เพิ่งจบ
    // เติมชื่อทีมของนัดนั้นให้ด้วย เพราะพาดหัวรีวิวหลังเกมมักไม่เขียนชื่อทีมตัวเอง
    // ใส่ทั้งชื่ออังกฤษและชื่อไทยสั้น เพราะข่าวในคลังมีทั้งพาดหัวไทยและอังกฤษ
    const keywords = new Set(keywordsFromTitle(upload.title));
    if (match && Math.abs(onAir - new Date(match.kickoffUtc).getTime()) <= 12 * 3_600_000) {
      for (const team of [match.home, match.away]) {
        keywords.add(team);
        keywords.add(thaiTeamShortName(team));
      }
    }

    try {
      await saveVideo(env, upload, { keywords: [...keywords].join(", ") });
      added.push(upload.url);
    } catch {
      // คลิปเดียวเขียนไม่ลงไม่ควรทำให้ทั้งรอบล้ม ตัวถัดไปยังมีสิทธิ์ขึ้น
    }
  }

  return { searched: true, added, note: added.length === 0 ? "ไม่มีคลิปใหม่ของช่อง" : "" };
}
