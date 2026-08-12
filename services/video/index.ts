// อ่านลิงก์คลิปแล้วดึงข้อมูลจริงมาให้
// ---------------------------------------------------------------------------
// เป้าหมายคือคนเพิ่มคลิปแค่วางลิงก์ ที่เหลือระบบเติมให้ — หัวข้อ ปก ชื่อช่อง
// วันที่ออนแอร์ และสถานะไลฟ์
//
// เรื่องโควตาที่ต้องระวังตั้งแต่ออกแบบ: YouTube Data API ให้ฟรีวันละ 10,000 หน่วย
//   videos.list  1 หน่วยต่อครั้ง   ใช้ตอนเพิ่มคลิปและตอนเช็กสถานะไลฟ์ของคลิปที่รู้ id
//   search.list  100 หน่วยต่อครั้ง ใช้ตอนค้นว่าช่องมีไลฟ์ใหม่ไหม
// ถ้าเช็กไลฟ์ด้วย search ทุกนาทีจะหมดโควตาใน 1 ชั่วโมง 40 นาที แล้วป้าย LIVE ดับทั้งวัน
// จึงใช้ videos.list เป็นหลัก และเรียก search เฉพาะช่วงหลังเกมจบซึ่งเป็นเวลาที่ช่องไลฟ์จริง

export type VideoPlatform = "youtube" | "tiktok";

export type VideoMetadata = {
  platform: VideoPlatform;
  videoId: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  channel: string;
  onAirAt: string | null;
  isLive: boolean;
};

/** ช่องฟุตบอลจีเนียส — ใช้ตอนค้นว่ามีไลฟ์หลังเกมขึ้นหรือยัง */
export const FOOTBALL_GENIUS_CHANNEL_ID = "UC82BBS4wEQ5GvqIcbEihRlw";

/**
 * แกะ id ออกจากลิงก์ — รองรับรูปแบบที่คนก๊อปมาวางจริง
 * youtube: watch?v= · youtu.be/ · /live/ · /shorts/ · /embed/
 * tiktok:  /video/ และลิงก์ย่อ vm./vt. ที่ยังไม่ได้คลี่ (เก็บทั้ง URL ไว้ให้ oEmbed จัดการ)
 */
export function parseVideoUrl(raw: string): { platform: VideoPlatform; videoId: string; url: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? { platform: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (host.endsWith("youtube.com")) {
    const fromQuery = url.searchParams.get("v");
    if (fromQuery) return { platform: "youtube", videoId: fromQuery, url: `https://www.youtube.com/watch?v=${fromQuery}` };
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => ["live", "shorts", "embed", "v"].includes(part));
    const id = marker >= 0 ? parts[marker + 1] : undefined;
    return id ? { platform: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (host.endsWith("tiktok.com")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.indexOf("video");
    const id = marker >= 0 ? parts[marker + 1] : parts[parts.length - 1];
    return id ? { platform: "tiktok", videoId: id, url: url.toString() } : null;
  }
  return null;
}

type YouTubeItem = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string; scheduledStartTime?: string };
};

async function youtubeVideos(ids: string[], apiKey: string) {
  const params = new URLSearchParams({
    part: "snippet,liveStreamingDetails",
    id: ids.join(","),
    key: apiKey,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`YouTube ${response.status}`);
  const payload = await response.json() as { items?: YouTubeItem[] };
  return payload.items ?? [];
}

function bestThumbnail(item: YouTubeItem) {
  const thumbs = item.snippet?.thumbnails ?? {};
  return thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? "";
}

function toMetadata(item: YouTubeItem): VideoMetadata {
  // ไลฟ์ที่จบแล้วจะยังมี liveStreamingDetails ติดมา แต่ liveBroadcastContent กลับเป็น none
  // จึงเชื่อ liveBroadcastContent เป็นหลัก ไม่ใช่เห็นว่ามี liveStreamingDetails แล้วติดป้าย LIVE
  const live = item.snippet?.liveBroadcastContent === "live";
  return {
    platform: "youtube",
    videoId: item.id,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    thumbnail: bestThumbnail(item),
    channel: item.snippet?.channelTitle ?? "",
    onAirAt: item.liveStreamingDetails?.actualStartTime ?? item.snippet?.publishedAt ?? null,
    isLive: live,
  };
}

/** TikTok oEmbed เป็นทางการ ไม่ต้องใช้คีย์ ให้หัวข้อ ปก และชื่อผู้โพสต์ */
async function tiktokMetadata(url: string, videoId: string): Promise<VideoMetadata> {
  const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`TikTok oEmbed ${response.status}`);
  const payload = await response.json() as {
    title?: string; author_name?: string; thumbnail_url?: string; embed_product_id?: string;
  };
  return {
    platform: "tiktok",
    videoId: payload.embed_product_id || videoId,
    url,
    title: payload.title ?? "",
    description: "",
    thumbnail: payload.thumbnail_url ?? "",
    channel: payload.author_name ?? "",
    // oEmbed ไม่ให้วันที่โพสต์มา จึงปล่อยว่างไว้ให้คนกรอกเอง ดีกว่าเดาเป็นวันที่เพิ่มคลิป
    onAirAt: null,
    isLive: false,
  };
}

/** ดึงข้อมูลคลิปจากลิงก์ — โยน error พร้อมข้อความไทยเมื่อทำไม่ได้ */
export async function fetchVideoMetadata(raw: string, youtubeKey?: string): Promise<VideoMetadata> {
  const parsed = parseVideoUrl(raw);
  if (!parsed) throw new Error("อ่านลิงก์ไม่ออก รองรับเฉพาะ YouTube และ TikTok");

  if (parsed.platform === "tiktok") return tiktokMetadata(parsed.url, parsed.videoId);

  if (!youtubeKey) throw new Error("ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY");
  const items = await youtubeVideos([parsed.videoId], youtubeKey);
  if (items.length === 0) throw new Error("ไม่พบคลิปนี้บน YouTube (อาจเป็นคลิปส่วนตัวหรือถูกลบ)");
  return toMetadata(items[0]);
}

/**
 * เช็กสถานะไลฟ์ของคลิปที่รู้ id อยู่แล้ว — 1 หน่วยต่อการเรียกหนึ่งครั้ง
 * ส่ง id ได้สูงสุด 50 ตัวต่อครั้งและยังคิดเป็น 1 หน่วยเท่าเดิม จึงถามทีเดียวทั้งชุด
 */
export async function refreshYouTubeLiveStatus(ids: string[], apiKey: string) {
  if (ids.length === 0) return new Map<string, boolean>();
  const items = await youtubeVideos(ids.slice(0, 50), apiKey);
  return new Map(items.map((item) => [item.id, item.snippet?.liveBroadcastContent === "live"]));
}

/**
 * ค้นว่าช่องกำลังไลฟ์อยู่ไหม — 100 หน่วยต่อครั้ง ห้ามเรียกถี่
 * ใช้เฉพาะช่วงหลังเกมจบที่ช่องมีไลฟ์จริง ไม่ใช่ยิงทั้งวัน
 */
export async function findChannelLive(channelId: string, apiKey: string) {
  const params = new URLSearchParams({
    part: "snippet", channelId, eventType: "live", type: "video", maxResults: "1", key: apiKey,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }> };
  const hit = payload.items?.[0];
  if (!hit?.id?.videoId) return null;
  return { videoId: hit.id.videoId, title: hit.snippet?.title ?? "" };
}
