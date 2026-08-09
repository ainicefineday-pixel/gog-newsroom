import type { RuntimeEnv } from "@/lib/server/database";

type YouTubeChannel = {
  id: string;
  snippet?: { title?: string; customUrl?: string; thumbnails?: { high?: { url?: string } } };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

type YouTubeVideo = {
  id: string;
  snippet?: { title?: string; publishedAt?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
};

function asNumber(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function youtubeJson<T>(path: string, key: string) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}${separator}key=${encodeURIComponent(key)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`YouTube API ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getChannelAnalytics(env: RuntimeEnv) {
  if (!env.YOUTUBE_API_KEY) {
    return {
      connected: false,
      platform: "youtube",
      handle: "@FootballGeniusAG",
      reason: "ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY",
      updatedAt: null,
      metrics: null,
      recentVideos: [],
      analysis: [],
    };
  }

  try {
    const channels = await youtubeJson<{ items?: YouTubeChannel[] }>(
      "channels?part=snippet,statistics,contentDetails&forHandle=FootballGeniusAG",
      env.YOUTUBE_API_KEY,
    );
    const channel = channels.items?.[0];
    if (!channel) throw new Error("ไม่พบช่อง @FootballGeniusAG");

    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    const playlist = uploads
      ? await youtubeJson<{ items?: Array<{ contentDetails?: { videoId?: string } }> }>(
        `playlistItems?part=contentDetails&maxResults=12&playlistId=${encodeURIComponent(uploads)}`,
        env.YOUTUBE_API_KEY,
      )
      : { items: [] };
    const ids = (playlist.items ?? []).flatMap((item) => item.contentDetails?.videoId ? [item.contentDetails.videoId] : []);
    const videosPayload = ids.length
      ? await youtubeJson<{ items?: YouTubeVideo[] }>(
        `videos?part=snippet,statistics&id=${encodeURIComponent(ids.join(","))}`,
        env.YOUTUBE_API_KEY,
      )
      : { items: [] };
    const videos = (videosPayload.items ?? []).map((video) => ({
      id: video.id,
      title: video.snippet?.title ?? "วิดีโอ",
      publishedAt: video.snippet?.publishedAt ?? null,
      views: asNumber(video.statistics?.viewCount),
      likes: asNumber(video.statistics?.likeCount),
      comments: asNumber(video.statistics?.commentCount),
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }));
    const avgViews = videos.length ? Math.round(videos.reduce((sum, video) => sum + video.views, 0) / videos.length) : 0;
    const avgEngagement = videos.length
      ? videos.reduce((sum, video) => sum + (video.views ? ((video.likes + video.comments) / video.views) * 100 : 0), 0) / videos.length
      : 0;
    const topVideo = [...videos].sort((left, right) => right.views - left.views)[0] ?? null;

    return {
      connected: true,
      platform: "youtube",
      handle: "@FootballGeniusAG",
      channelId: channel.id,
      title: channel.snippet?.title ?? "Football Genius",
      thumbnail: channel.snippet?.thumbnails?.high?.url ?? null,
      updatedAt: new Date().toISOString(),
      metrics: {
        subscribers: channel.statistics?.hiddenSubscriberCount ? null : asNumber(channel.statistics?.subscriberCount),
        totalViews: asNumber(channel.statistics?.viewCount),
        totalVideos: asNumber(channel.statistics?.videoCount),
        avgViewsLast12: avgViews,
        avgEngagementLast12: Number(avgEngagement.toFixed(2)),
      },
      recentVideos: videos,
      analysis: [
        videos.length ? `ยอดดูเฉลี่ย ${avgViews.toLocaleString("th-TH")} ครั้งจาก ${videos.length} คลิปล่าสุด` : "ยังไม่มีคลิปล่าสุดให้คำนวณ",
        videos.length ? `อัตรามีส่วนร่วมเฉลี่ย ${avgEngagement.toFixed(2)}% จากยอดไลก์และความคิดเห็นต่อยอดดู` : "ยังคำนวณอัตรามีส่วนร่วมไม่ได้",
        topVideo ? `คลิปเด่นในชุดข้อมูล: “${topVideo.title}” (${topVideo.views.toLocaleString("th-TH")} วิว)` : "ยังระบุคลิปเด่นไม่ได้",
      ],
    };
  } catch (error) {
    return {
      connected: false,
      platform: "youtube",
      handle: "@FootballGeniusAG",
      reason: error instanceof Error ? error.message : "เชื่อมต่อ YouTube API ไม่สำเร็จ",
      updatedAt: null,
      metrics: null,
      recentVideos: [],
      analysis: [],
    };
  }
}
