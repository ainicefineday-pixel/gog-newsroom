"use client";

// แถบคลิปบนหน้าข่าว — YouTube แนวนอน และ TikTok แนวตั้ง
// ---------------------------------------------------------------------------
// ปกกับหัวข้อดึงมาจากแพลตฟอร์มตอนเพิ่มคลิปแล้วเก็บลงฐานข้อมูล คนเปิดเว็บจึงไม่ทำให้
// เกิดการยิงถาม YouTube สักครั้ง — โควตาวันละ 10,000 หน่วยจะถูกใช้แค่ตอนเพิ่มคลิป
// กับตอนรีเฟรชป้าย LIVE เท่านั้น
//
// ยังไม่ฝัง iframe จนกว่าจะกดเล่น เพราะ iframe ของ YouTube กับ TikTok ลากสคริปต์
// และคุกกี้ของเขามาด้วยทุกตัว ถ้าฝังไว้ล่วงหน้าห้าคลิป หน้าข่าวจะอืดตั้งแต่เปิด
// และผู้อ่านจะถูกติดตามทั้งที่ยังไม่ได้ดูอะไรเลย

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pin, Play, Plus, Radio, RefreshCw, Trash2, X } from "lucide-react";
import { usePersistedState } from "@/lib/persisted-state";


type RelatedStory = { id: string; title: string; source: string; url: string };

/** คลิปปักหมุด — รูปร่างเดียวกับที่ /api/featured-clip ส่งกลับมา */
type FeaturedClip = {
  src: string;
  poster: string;
  title: string;
  description: string;
  durationSec: number;
  badge: string;
};

type Video = {
  id: string;
  platform: "youtube" | "tiktok";
  videoId: string;
  url: string;
  title: string;
  description: string;
  keywords: string[];
  thumbnail: string;
  channel: string;
  onAirAt: string | null;
  isLive: boolean;
  relatedStories: RelatedStory[];
  relatedMatch: { home: string; away: string; kickoffUtc: string } | null;
};

/** รหัสแอดมินเก็บใน sessionStorage ไม่ใช่ localStorage — ปิดแท็บแล้วหาย */
const SECRET_KEY = "gog.admin-secret";

function onAirLabel(value: string | null) {
  if (!value) return "ยังไม่ระบุวันออนแอร์";
  const stamp = new Date(value);
  const label = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(stamp);
  const days = Math.floor((Date.now() - stamp.getTime()) / 86_400_000);
  if (days <= 0) return `ออนแอร์วันนี้ · ${label} น.`;
  if (days === 1) return `ออนแอร์เมื่อวาน · ${label} น.`;
  return `ออนแอร์เมื่อ ${days} วันก่อน · ${label} น.`;
}

function VideoCard({ video, secret, onRemoved }: {
  video: Video;
  secret: string;
  onRemoved: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const embed = video.platform === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1`
    : `https://www.tiktok.com/embed/v2/${video.videoId}`;

  return (
    <article className={`video-card ${video.platform}`}>
      <div className="video-frame">
        {playing ? (
          <iframe
            src={embed}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="video-cover" onClick={() => setPlaying(true)}>
            {video.thumbnail
              ? <img src={video.thumbnail} alt="" loading="lazy" />
              : <span className="video-cover-blank">ไม่มีภาพปก</span>}
            <span className="video-play" aria-hidden="true"><Play size={18} /></span>
            <span className="sr-only">เล่นคลิป {video.title}</span>
          </button>
        )}
        {video.isLive && <span className="video-live"><Radio size={10} aria-hidden="true" />LIVE</span>}
        {secret && (
          <button
            type="button"
            className="video-remove"
            title="เอาคลิปนี้ออก"
            onClick={() => {
              void fetch(`/api/videos/${encodeURIComponent(video.id)}`, {
                method: "DELETE",
                headers: { authorization: `Bearer ${secret}` },
              }).then(() => onRemoved(video.id));
            }}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="video-body">
        <b>{video.title}</b>
        <span className="video-meta">
          {video.channel && <em>{video.channel}</em>}
          {onAirLabel(video.onAirAt)}
        </span>
        {video.description && <p>{video.description}</p>}
        {video.keywords.length > 0 && (
          <div className="video-keywords">
            {video.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
          </div>
        )}
        {video.relatedStories.length > 0 && (
          <div className="video-related">
            <em>ข่าวที่เกี่ยวข้องในคลัง</em>
            <ul>
              {video.relatedStories.map((story) => (
                <li key={story.id}>
                  <a href={story.url} target="_blank" rel="noreferrer">{story.title}</a>
                  <small>{story.source}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

function AddVideoForm({ secret, onAdded, onClose }: {
  secret: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    fetch("/api/videos", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ url, title: title || undefined, description: description || undefined, keywords }),
    })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; error?: string }) => {
        if (!payload.ok) { setError(payload.error ?? "เพิ่มคลิปไม่สำเร็จ"); return; }
        setUrl(""); setTitle(""); setDescription(""); setKeywords("");
        onAdded();
        onClose();
      })
      .catch(() => setError("ต่อกับเซิร์ฟเวอร์ไม่ได้"))
      .finally(() => setBusy(false));
  };

  return (
    <form className="video-form" onSubmit={submit}>
      <header>
        <b>เพิ่มคลิป</b>
        <button type="button" onClick={onClose} aria-label="ปิด"><X size={13} /></button>
      </header>
      <label>
        ลิงก์คลิป
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="วางลิงก์ YouTube หรือ TikTok"
          required
        />
      </label>
      <p className="video-form-hint">หัวข้อ ปก ชื่อช่อง และวันออนแอร์ ระบบดึงให้เอง เว้นว่างไว้ได้</p>
      <label>
        หัวข้อ (ถ้าอยากตั้งเอง)
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เว้นว่าง = ใช้หัวข้อจริงของคลิป" />
      </label>
      <label>
        คำอธิบาย
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
      </label>
      <label>
        คำค้น (คั่นด้วยจุลภาค)
        <input
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          placeholder="เช่น Lewis-Skelly, Carrick, ลีดส์"
        />
      </label>
      <p className="video-form-hint">
        คำค้นคือสิ่งที่ใช้จับคลิปเข้ากับข่าวในคลังของเรา ใส่ชื่อนักเตะหรือเรื่องที่คลิปพูดถึง
        แล้วระบบจะขึ้นข่าวที่เกี่ยวข้องพร้อมชื่อสำนักข่าวให้ใต้คลิปเอง
      </p>
      {error && <p className="video-form-error">{error}</p>}
      <button type="submit" className="video-form-submit" disabled={busy || !url}>
        {busy ? <><Loader2 size={13} className="spin" />กำลังดึงข้อมูลคลิป…</> : "เพิ่มคลิป"}
      </button>
    </form>
  );
}

/**
 * คลิปปักหมุด
 *
 * เล่นด้วย <video> ตรง ๆ เพราะเป็นไฟล์ของเราเอง ไม่ต้องฝัง iframe ของใคร และ
 * ยังไม่โหลดตัวไฟล์จนกว่าจะกดเล่น — คลิปแนวตั้งหนักกว่ารูปมาก คนที่เปิดหน้าข่าว
 * ด้วยเน็ตมือถือไม่ควรโดนดูดเน็ตทั้งที่ยังไม่ได้ดู ภาพปกเป็นไฟล์ 23 KB ที่แยกไว้
 * ต่างหาก จึงเห็นว่าคลิปคืออะไรก่อนตัดสินใจกด
 */
function FeaturedClipCard() {
  const [playing, setPlaying] = useState(false);
  const [clip, setClip] = useState<FeaturedClip | null>(null);

  // อ่านจากฐานข้อมูลผ่าน API ทุกครั้งที่เปิดหน้า บรรณาธิการเปลี่ยนคลิปที่หน้า
  // /admin แล้วคนอ่านเห็นของใหม่ทันทีโดยไม่ต้อง deploy
  useEffect(() => {
    fetch("/api/featured-clip")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ok?: boolean; clip?: FeaturedClip | null } | null) => {
        setClip(payload?.ok ? (payload.clip ?? null) : null);
      })
      .catch(() => setClip(null));
  }, []);

  if (!clip) return null;

  const minutes = Math.floor(clip.durationSec / 60);
  const seconds = clip.durationSec % 60;
  const length =
    minutes > 0
      ? `${minutes}:${String(seconds).padStart(2, "0")} นาที`
      : `${seconds} วินาที`;

  return (
    <article className="featured-clip">
      <div className="featured-frame">
        {playing ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={clip.src}
            poster={clip.poster}
            controls
            autoPlay
            playsInline
            preload="auto"
          />
        ) : (
          <button type="button" className="featured-cover" onClick={() => setPlaying(true)}>
            <img src={clip.poster} alt="" loading="lazy" />
            <span className="featured-play" aria-hidden="true"><Play size={20} /></span>
            <span className="sr-only">เล่นคลิป {clip.title}</span>
          </button>
        )}
        <span className="featured-badge">
          <Pin size={10} aria-hidden="true" />
          {clip.badge}
        </span>
      </div>
      <div className="featured-body">
        <b>{clip.title}</b>
        <span className="featured-meta">{length} · แนวตั้ง 9:16</span>
        <p>{clip.description}</p>
      </div>
    </article>
  );
}

export function VideoShelf() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  /** เก็บเฉพาะแท็บนี้ ปิดแท็บแล้วต้องกรอกใหม่ — ไม่ทิ้งกุญแจไว้บนเครื่องข้ามวัน */
  const [secret, saveSecret] = usePersistedState(SECRET_KEY, "", "session");
  const [showForm, setShowForm] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  const load = useCallback(() => {
    fetch("/api/videos")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ok?: boolean; videos?: Video[] } | null) => {
        setVideos(payload?.ok ? payload.videos ?? [] : []);
      })
      .catch(() => setVideos([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const youtube = (videos ?? []).filter((video) => video.platform === "youtube");
  const tiktok = (videos ?? []).filter((video) => video.platform === "tiktok");

  return (
    <section className="video-shelf" aria-labelledby="video-shelf-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">WATCH</span>
          <h2 id="video-shelf-heading">คลิปที่เลือกมาให้</h2>
        </div>
        <div className="video-shelf-actions">
          {secret ? (
            <>
              {/* ปกติครอนดึงคลิปใหม่ของช่องให้เองในช่วงหลังเกม ปุ่มนี้ไว้สั่งเดี๋ยวนี้
                  ตอนช่องลงคลิปนอกเวลาที่คาด — กดหนึ่งครั้งใช้โควตา 2 หน่วย */}
              <button
                type="button"
                className="video-add ghost"
                disabled={syncing}
                onClick={() => {
                  setSyncing(true);
                  setSyncNote("");
                  fetch("/api/videos/sync", { method: "POST", headers: { authorization: `Bearer ${secret}` } })
                    .then((response) => response.json())
                    .then((payload: { ok?: boolean; added?: string[]; note?: string }) => {
                      const count = payload.added?.length ?? 0;
                      setSyncNote(count > 0 ? `ดึงคลิปใหม่มา ${count} คลิป` : payload.note || "ไม่มีคลิปใหม่ของช่อง");
                      if (count > 0) load();
                    })
                    .catch(() => setSyncNote("ต่อกับเซิร์ฟเวอร์ไม่ได้"))
                    .finally(() => setSyncing(false));
                }}
              >
                {syncing
                  ? <><Loader2 size={13} className="spin" aria-hidden="true" />กำลังดึง…</>
                  : <><RefreshCw size={13} aria-hidden="true" />ดึงคลิปใหม่จากช่อง</>}
              </button>
              <button type="button" className="video-add" onClick={() => setShowForm((value) => !value)}>
                <Plus size={13} aria-hidden="true" />เพิ่มคลิป
              </button>
            </>
          ) : (
            <button type="button" className="video-add ghost" onClick={() => setShowSecret((value) => !value)}>
              โหมดแอดมิน
            </button>
          )}
        </div>
      </div>

      {/* ปุ่มเพิ่มคลิปอยู่หลังรหัสแอดมินตัวเดียวกับ endpoint แอดมินอื่นของระบบ
          เว็บเปิดสาธารณะ ถ้าไม่กันไว้ใครก็เอาคลิปอะไรก็ได้ขึ้นหน้าแรกเรา
          เก็บใน sessionStorage ไม่ใช่ localStorage ปิดแท็บแล้วหายไปเลย */}
      {showSecret && !secret && (
        <div className="video-secret">
          <input
            type="password"
            placeholder="รหัสแอดมิน (CRON_SECRET)"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              saveSecret((event.target as HTMLInputElement).value.trim());
              setShowSecret(false);
            }}
          />
          <small>กด Enter เพื่อยืนยัน · รหัสเก็บไว้เฉพาะแท็บนี้ ปิดแท็บแล้วหาย</small>
        </div>
      )}

      {syncNote && <p className="video-empty">{syncNote}</p>}

      {showForm && secret && (
        <AddVideoForm secret={secret} onAdded={load} onClose={() => setShowForm(false)} />
      )}

      {/* ปักหมุดไว้หัวแถบเสมอ ไม่ปะปนกับคลิปที่ครอนดึงเข้ามา และไม่หายไปเมื่อ
          มีคลิปใหม่จากช่อง — นั่นคือความหมายของการปักหมุด */}
      <FeaturedClipCard />

      {videos === null && <p className="video-empty">กำลังโหลดคลิป…</p>}
      {videos !== null && videos.length === 0 && (
        <p className="video-empty">
          ยังไม่มีคลิปจากช่องในระบบ — เพิ่มได้ที่นี่ หรือปักหมุดคลิปของเราเองที่หน้า /admin
        </p>
      )}

      {youtube.length > 0 && (
        <div className="video-row">
          <h3>YouTube</h3>
          <div className="video-track landscape">
            {youtube.map((video) => (
              <VideoCard key={video.id} video={video} secret={secret} onRemoved={load} />
            ))}
          </div>
        </div>
      )}

      {tiktok.length > 0 && (
        <div className="video-row">
          <h3>TikTok</h3>
          <div className="video-track portrait">
            {tiktok.map((video) => (
              <VideoCard key={video.id} video={video} secret={secret} onRemoved={load} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
