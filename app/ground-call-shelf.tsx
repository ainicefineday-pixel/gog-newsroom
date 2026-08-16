"use client";

// แถบคลิปจากสตูดิโอ GROUND CALL
// ---------------------------------------------------------------------------
// คลิปพวกนี้ไม่ได้มาจาก YouTube หรือ TikTok แต่เป็นไฟล์ 1080×1920 ที่สตูดิโอ
// เรนเดอร์เองแล้วยิงเข้ามาทาง /api/ground-call/clips จึงเล่นด้วย <video> ตรง ๆ
// ไม่ต้องฝัง iframe ของใคร และไม่มีสคริปต์ติดตามของแพลตฟอร์มไหนติดมา
//
// ไม่มีคลิปก็ไม่ขึ้นอะไรเลย หน้าข่าวของเดิมจึงไม่เปลี่ยนจนกว่าจะมีคลิปจริงเข้ามา

import { useEffect, useState } from "react";
import { Clock, Mic, Play } from "lucide-react";

type GroundCallClip = {
  externalId: string;
  title: string;
  slug: string;
  summary: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  competition: string;
  mode: string;
  hashtags: string[];
  speakerNames: string[];
  subtitleUrls: { srt: string | null; vtt: string | null };
  publishedAt: string;
};

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")} นาที` : `${rest} วินาที`;
}

function publishedLabel(value: string) {
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return "";
  const minutes = Math.floor((Date.now() - stamp.getTime()) / 60_000);
  if (minutes < 60) return `เผยแพร่เมื่อ ${Math.max(minutes, 1)} นาทีที่แล้ว`;
  if (minutes < 60 * 24) return `เผยแพร่เมื่อ ${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`;
  return `เผยแพร่ ${new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short",
  }).format(stamp)}`;
}

const MODE_LABEL: Record<string, string> = {
  POST_MATCH: "หลังเกม",
  PRE_MATCH: "ก่อนเกม",
  FEATURE: "สกู๊ป",
};

function ClipCard({ clip }: { clip: GroundCallClip }) {
  const [playing, setPlaying] = useState(false);

  return (
    <article className="gc-card">
      <div className="gc-frame">
        {playing ? (
          // preload ตอนกดเล่นเท่านั้น คลิปแนวตั้งไฟล์ใหญ่ ถ้าโหลดล่วงหน้าห้าคลิป
          // คนเปิดหน้าข่าวด้วยเน็ตมือถือจะโดนดูดเน็ตทั้งที่ยังไม่ได้ดูอะไร
          //
          // ซับไตเติลใส่ให้เมื่อสตูดิโอส่ง .vtt มาด้วย คลิปที่ยังไม่มีไฟล์ซับก็ยังต้องเล่นได้
          // จะใส่ <track> ที่ไม่มี src ให้ผ่านกฎเฉย ๆ ไม่ได้ เพราะเบราว์เซอร์จะยิงโหลดไฟล์ที่ไม่มีอยู่
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={clip.videoUrl}
            poster={clip.thumbnailUrl || undefined}
            controls
            autoPlay
            playsInline
            preload="auto"
          >
            {clip.subtitleUrls.vtt && (
              <track kind="captions" srcLang="th" label="ไทย" src={clip.subtitleUrls.vtt} default />
            )}
          </video>
        ) : (
          <button type="button" className="gc-cover" onClick={() => setPlaying(true)}>
            {clip.thumbnailUrl
              ? <img src={clip.thumbnailUrl} alt="" loading="lazy" />
              : <span className="gc-cover-blank">GROUND CALL</span>}
            <span className="gc-play" aria-hidden="true"><Play size={18} /></span>
            <span className="sr-only">เล่นคลิป {clip.title}</span>
          </button>
        )}
        <span className="gc-badge">GROUND CALL</span>
      </div>

      <div className="gc-body">
        <b>{clip.title}</b>
        <span className="gc-meta">
          <Clock size={11} aria-hidden="true" />{durationLabel(clip.durationSec)}
          {clip.mode && <em>{MODE_LABEL[clip.mode] ?? clip.mode}</em>}
          {publishedLabel(clip.publishedAt)}
        </span>
        {clip.speakerNames.length > 0 && (
          <span className="gc-speakers">
            <Mic size={11} aria-hidden="true" />{clip.speakerNames.join(" · ")}
          </span>
        )}
        {clip.summary && <p>{clip.summary}</p>}
        {clip.hashtags.length > 0 && (
          <div className="gc-tags">
            {clip.hashtags.map((tag) => <span key={tag}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}
          </div>
        )}
      </div>
    </article>
  );
}

export function GroundCallShelf() {
  const [clips, setClips] = useState<GroundCallClip[]>([]);

  useEffect(() => {
    fetch("/api/ground-call/clips?limit=12")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ok?: boolean; clips?: GroundCallClip[] } | null) => {
        setClips(payload?.ok ? payload.clips ?? [] : []);
      })
      .catch(() => setClips([]));
  }, []);

  if (clips.length === 0) return null;

  return (
    <section className="gc-shelf" aria-labelledby="ground-call-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">GROUND CALL</span>
          <h2 id="ground-call-heading">คุยกันสด ตัดเป็นคลิปให้แล้ว</h2>
        </div>
      </div>
      <div className="gc-track">
        {clips.map((clip) => <ClipCard key={clip.externalId} clip={clip} />)}
      </div>
    </section>
  );
}
