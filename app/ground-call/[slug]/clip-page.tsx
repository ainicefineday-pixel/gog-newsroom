"use client";

// หน้าคลิปเดี่ยวของ GROUND CALL
// ---------------------------------------------------------------------------
// ลิงก์นี้คือสิ่งที่สตูดิโอได้กลับไปตอนกดเผยแพร่ จึงต้องเปิดตรงได้และแชร์ต่อได้
// ข้อมูลอ่านจาก /api/ground-call/clips/<slug> ฝั่งเบราว์เซอร์ เหมือนหน้าอื่นของเว็บ

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, FileText, Mic, Subtitles } from "lucide-react";

type GroundCallClip = {
  externalId: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  competition: string;
  mode: string;
  tags: string[];
  hashtags: string[];
  speakerNames: string[];
  transcriptUrl: string | null;
  subtitleUrls: { srt: string | null; vtt: string | null };
  sourceReferences: string[];
  publishedAt: string;
};

const MODE_LABEL: Record<string, string> = {
  POST_MATCH: "หลังเกม",
  PRE_MATCH: "ก่อนเกม",
  FEATURE: "สกู๊ป",
};

export function GroundCallClipPage({ slug }: { slug: string }) {
  const [clip, setClip] = useState<GroundCallClip | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    fetch(`/api/ground-call/clips/${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ok?: boolean; clip?: GroundCallClip } | null) => {
        if (payload?.ok && payload.clip) {
          setClip(payload.clip);
          setState("ready");
        } else {
          setState("missing");
        }
      })
      .catch(() => setState("missing"));
  }, [slug]);

  return (
    <main className="gc-page">
      <Link href="/" className="gc-page-back">
        <ArrowLeft size={13} aria-hidden="true" />กลับหน้าข่าว
      </Link>

      {state === "loading" && <p className="gc-page-note">กำลังโหลดคลิป…</p>}
      {state === "missing" && (
        <p className="gc-page-note">ไม่พบคลิปนี้ — อาจถูกถอนออกจากหน้าเว็บแล้ว</p>
      )}

      {clip && (
        <article className="gc-page-clip">
          <div className="gc-page-frame">
            {/* ซับไตเติลขึ้นเมื่อสตูดิโอส่ง .vtt มา — ดูเหตุผลเดียวกันใน ground-call-shelf.tsx */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={clip.videoUrl}
              poster={clip.thumbnailUrl || undefined}
              controls
              playsInline
              preload="metadata"
            >
              {clip.subtitleUrls.vtt && (
                <track kind="captions" srcLang="th" label="ไทย" src={clip.subtitleUrls.vtt} default />
              )}
            </video>
          </div>

          <div className="gc-page-body">
            <span className="eyebrow">GROUND CALL</span>
            <h1>{clip.title}</h1>
            <div className="gc-meta">
              <Clock size={11} aria-hidden="true" />
              {Math.floor(clip.durationSec / 60)}:{String(clip.durationSec % 60).padStart(2, "0")} นาที
              {clip.mode && <em>{MODE_LABEL[clip.mode] ?? clip.mode}</em>}
              {clip.competition && <em>{clip.competition}</em>}
              {new Intl.DateTimeFormat("th-TH", {
                timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short",
              }).format(new Date(clip.publishedAt))} น.
            </div>
            {clip.speakerNames.length > 0 && (
              <div className="gc-speakers">
                <Mic size={11} aria-hidden="true" />{clip.speakerNames.join(" · ")}
              </div>
            )}
            {clip.summary && <p className="gc-page-summary">{clip.summary}</p>}
            {clip.body && <div className="gc-page-text">{clip.body}</div>}
            {clip.hashtags.length > 0 && (
              <div className="gc-tags">
                {clip.hashtags.map((tag) => <span key={tag}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}
              </div>
            )}

            {/* แหล่งอ้างอิงมาจากบทวิจัยของสตูดิโอ ขึ้นไว้เพราะคลิปพูดถึงข้อเท็จจริง
                ที่มีที่มา คนอ่านควรตามไปตรวจเองได้ */}
            {clip.sourceReferences.length > 0 && (
              <div className="gc-page-sources">
                <b>แหล่งอ้างอิงที่ใช้เตรียมคำถาม</b>
                <ul>
                  {clip.sourceReferences.map((source) => (
                    <li key={source}>
                      {/^https?:\/\//.test(source)
                        ? <a href={source} target="_blank" rel="noreferrer">{source}</a>
                        : source}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="gc-page-files">
              {clip.transcriptUrl && (
                <a href={clip.transcriptUrl} target="_blank" rel="noreferrer">
                  <FileText size={12} aria-hidden="true" />บทถอดเสียง
                </a>
              )}
              {clip.subtitleUrls.srt && (
                <a href={clip.subtitleUrls.srt} target="_blank" rel="noreferrer">
                  <Subtitles size={12} aria-hidden="true" />ซับไตเติล (.srt)
                </a>
              )}
            </div>
          </div>
        </article>
      )}
    </main>
  );
}
