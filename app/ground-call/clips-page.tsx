"use client";

// หน้ารวมคลิปจากสตูดิโอ GROUND CALL
// ---------------------------------------------------------------------------
// แถบบนหน้าข่าวโชว์ได้ทีละไม่กี่คลิป หน้านี้คือที่ที่ดูได้ทั้งหมด และเป็นปลายทาง
// ของเมนู Admin บนแถบนำทาง
//
// อ่านจาก /api/ground-call/clips ซึ่งเปิดสาธารณะ — คลิปที่ขึ้นแล้วคือของที่
// เผยแพร่แล้ว ไม่มีอะไรต้องซ่อน ส่วนการส่งคลิปเข้ามาต้องมีคีย์เสมอ

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Mic } from "lucide-react";

type GroundCallClip = {
  externalId: string;
  title: string;
  slug: string;
  summary: string;
  thumbnailUrl: string;
  durationSec: number;
  competition: string;
  mode: string;
  speakerNames: string[];
  publishedAt: string;
};

const MODE_LABEL: Record<string, string> = {
  POST_MATCH: "หลังเกม",
  PRE_MATCH: "ก่อนเกม",
  FEATURE: "สกู๊ป",
};

function lengthLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")} นาที` : `${rest} วินาที`;
}

export function GroundCallClipsPage() {
  const [clips, setClips] = useState<GroundCallClip[] | null>(null);

  useEffect(() => {
    fetch("/api/ground-call/clips?limit=50")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ok?: boolean; clips?: GroundCallClip[] } | null) => {
        setClips(payload?.ok ? (payload.clips ?? []) : []);
      })
      .catch(() => setClips([]));
  }, []);

  return (
    <main className="gc-page">
      <Link href="/" className="gc-page-back">
        <ArrowLeft size={13} aria-hidden="true" />กลับหน้าข่าว
      </Link>

      <div className="gc-index-head">
        <span className="eyebrow">GROUND CALL</span>
        <h1>คลิปจากสตูดิโอ</h1>
        <p>
          บทสนทนาระหว่างอั้มกับโย่ ที่สตูดิโอตัดเป็นคลิปแนวตั้งแล้วส่งเข้ามาที่หน้าข่าวนี้
        </p>
      </div>

      {clips === null && <p className="gc-page-note">กำลังโหลด…</p>}

      {clips !== null && clips.length === 0 && (
        <p className="gc-page-note">
          ยังไม่มีคลิปที่เผยแพร่ — คลิปจะขึ้นที่นี่เองเมื่อสตูดิโอกดเผยแพร่
        </p>
      )}

      {clips !== null && clips.length > 0 && (
        <div className="gc-index-grid">
          {clips.map((clip) => (
            <Link
              key={clip.externalId}
              href={`/ground-call/${encodeURIComponent(clip.slug)}`}
              className="gc-index-card"
            >
              <div className="gc-index-frame">
                {clip.thumbnailUrl ? (
                  <img src={clip.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <span className="gc-cover-blank">GROUND CALL</span>
                )}
              </div>
              <b>{clip.title}</b>
              <span className="gc-meta">
                <Clock size={11} aria-hidden="true" />
                {lengthLabel(clip.durationSec)}
                {clip.mode && <em>{MODE_LABEL[clip.mode] ?? clip.mode}</em>}
              </span>
              {clip.speakerNames.length > 0 && (
                <span className="gc-speakers">
                  <Mic size={11} aria-hidden="true" />
                  {clip.speakerNames.join(" · ")}
                </span>
              )}
              {clip.summary && <p>{clip.summary}</p>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
