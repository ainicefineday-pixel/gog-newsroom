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
  fetchVideoMetadata, findChannelLive, FOOTBALL_GENIUS_CHANNEL_ID, refreshYouTubeLiveStatus, type VideoPlatform,
} from "@/services/video";
import { currentNavMatch, FULL_TIME_MINUTES, POST_MATCH_WINDOW_MINUTES } from "@/services/football/next-match";

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

  return { id, ...meta };
}

export async function removeVideo(env: RuntimeEnv, id: string) {
  const result = await env.DB!.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
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

/**
 * หาไลฟ์หลังเกมของช่องแล้วเอาขึ้นแถบคลิปให้เอง
 *
 * ยิงเฉพาะช่วงครึ่งชั่วโมงหลังเกมจบ ซึ่งเป็นเวลาที่ช่องไลฟ์จริง
 * เพราะ search.list กินโควตาครั้งละ 100 หน่วยจากวันละ 10,000
 * ครอนวิ่งทุก 10 นาที ในหน้าต่างนี้จึงยิงแค่ 3 ครั้งต่อนัด = 300 หน่วย
 * ถ้ายิงทั้งวันจะเป็น 14,400 หน่วย ซึ่งเกินโควตาไปเกือบครึ่ง
 */
export async function syncPostMatchLive(env: RuntimeEnv) {
  if (!env.YOUTUBE_API_KEY) return { searched: false, added: null as string | null, note: "ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY" };

  const match = currentNavMatch();
  if (!match) return { searched: false, added: null, note: "ไม่มีนัดในระบบ" };

  const elapsedMinutes = (Date.now() - new Date(match.kickoffUtc).getTime()) / 60_000;
  if (elapsedMinutes < FULL_TIME_MINUTES || elapsedMinutes > FULL_TIME_MINUTES + POST_MATCH_WINDOW_MINUTES) {
    return { searched: false, added: null, note: "ยังไม่ถึงช่วงหลังเกม" };
  }

  const live = await findChannelLive(FOOTBALL_GENIUS_CHANNEL_ID, env.YOUTUBE_API_KEY);
  if (!live) return { searched: true, added: null, note: "ช่องยังไม่ได้เปิดไลฟ์" };

  const url = `https://www.youtube.com/watch?v=${live.videoId}`;
  try {
    // คำค้นตั้งจากชื่อทีมทั้งสองฝั่ง ไลฟ์หลังเกมจะได้ผูกกับข่าวของนัดนั้นเอง
    await addVideo(env, { url, keywords: `${match.home}, ${match.away}` });
    return { searched: true, added: url, note: "" };
  } catch (error) {
    return { searched: true, added: null, note: error instanceof Error ? error.message.slice(0, 160) : "เพิ่มคลิปไลฟ์ไม่สำเร็จ" };
  }
}
