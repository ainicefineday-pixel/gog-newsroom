"use client";

// แถบนัดถัดไปบน nav — นับถอยหลัง เส้นเวลาเกม อากาศที่สนาม และข่าวล่าสุด
// ---------------------------------------------------------------------------
// ทุกอย่างบนแถบนี้คำนวณจากเวลาเตะจริงในปฏิทินกับค่าที่ขอมาสด ๆ ไม่มีค่าประดับ
//
// เส้นเวลาเกมเป็น "เส้นตามเวลาที่ผ่านไป" ไม่ใช่นาฬิกาแมตช์ของจริง
// เพราะผู้ให้บริการแพ็กฟรีไม่มีข้อมูลสดระดับนาที (ดู docs/FOOTBALL-DATA.md)
// เวลาพักครึ่งกับจบเกมจึงเขียนกำกับว่าโดยประมาณทุกจุด ไม่ใช่ทำเนียนว่ารู้เวลาจริง
//
// เรื่องตราสโมสร: ใช้อักษรย่อสามตัวบนชิปสีแทนโลโก้จริง เพราะตราสโมสรเป็น
// เครื่องหมายการค้าที่มีเจ้าของ การดึงไฟล์โลโก้จาก API มาแสดงไม่ได้แปลว่าได้สิทธิ์ใช้

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, ChevronDown, CloudSun, GripVertical, Radio, Tv, Wind } from "lucide-react";
import { Marquee } from "@/app/terminal";
import { MU_FIRST_TEAM_SQUAD, type SquadPosition } from "@/config/mu-squad";
import { TEAM_NAMES } from "@/services/football/thai";
import {
  FIRST_HALF_END, MATCH_WINDOW_MINUTES, SECOND_HALF_START, type NavMatch,
} from "@/services/football/next-match";
import type { VenueConditions } from "@/services/weather";

/** ไลฟ์หลังเกมของช่อง — ขึ้นปุ่มให้ตั้งแต่จบเกมจนถึงครึ่งชั่วโมงหลังจากนั้น */
const FOOTBALL_GENIUS_STREAMS = "https://www.youtube.com/@FootballGeniusAG/streams";
const POST_MATCH_WINDOW_MINUTES = 30;
/** นาทีที่ครึ่งหลังควรจบ นับจากเขี่ยบอล — 45 + 15 พักครึ่ง + 45 */
const FULL_TIME_MINUTES = 105;
/** เตือนล่วงหน้ากี่นาทีก่อนเขี่ยบอล */
const PREMATCH_ALERT_MINUTES = 5;

const STORAGE_KEY = "gog.match-strip";

type LatestStory = { id: string; titleTh: string; source: string; publishedAt: string } | null;
type StripData = {
  match: NavMatch | null;
  conditions: VenueConditions | null;
  nextMatch: NavMatch | null;
  latestStory: LatestStory;
};

const thaiName = (club: string) => TEAM_NAMES[club]?.short ?? club;

const POSITION_TH: Record<SquadPosition, string> = {
  Goalkeeper: "ผู้รักษาประตู",
  Defender: "กองหลัง",
  Midfielder: "กองกลาง",
  Forward: "กองหน้า",
};

function phaseOf(elapsedMinutes: number) {
  if (elapsedMinutes < 0) return { key: "upcoming" as const, label: "ยังไม่เริ่ม" };
  if (elapsedMinutes < FIRST_HALF_END) {
    return { key: "first" as const, label: `ครึ่งแรก · ราวนาทีที่ ${Math.floor(elapsedMinutes) + 1}` };
  }
  if (elapsedMinutes < SECOND_HALF_START) return { key: "half" as const, label: "พักครึ่ง" };
  if (elapsedMinutes < FULL_TIME_MINUTES) {
    return { key: "second" as const, label: `ครึ่งหลัง · ราวนาทีที่ ${45 + Math.floor(elapsedMinutes - SECOND_HALF_START) + 1}` };
  }
  if (elapsedMinutes < MATCH_WINDOW_MINUTES) return { key: "stoppage" as const, label: "ช่วงท้ายเกม" };
  return { key: "done" as const, label: "จบเกม" };
}

function countdown(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (days > 0) return `${days} วัน ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function clockAt(baseIso: string, addMinutes: number, timeZone: string) {
  const stamp = new Date(new Date(baseIso).getTime() + addMinutes * 60_000);
  return new Intl.DateTimeFormat("th-TH", { timeZone, hour: "2-digit", minute: "2-digit" }).format(stamp);
}

function dayTimeAt(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * เสียงเตือน — สร้างจาก WebAudio ไม่ต้องโหลดไฟล์เสียง
 * ต้องให้ผู้ใช้กดเปิดเองก่อน เพราะเบราว์เซอร์บล็อกเสียงที่เล่นเองโดยไม่มีการกด
 * และการมีเสียงดังขึ้นมาเองบนหน้าข่าวก็ไม่สุภาพกับคนที่เปิดทิ้งไว้หลายแท็บ
 */
function useChime(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  return useCallback((pattern: number[]) => {
    if (!enabled) return;
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      contextRef.current ??= new AudioCtor();
      const context = contextRef.current;
      void context.resume();
      pattern.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = context.currentTime + index * 0.22;
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.22);
      });
    } catch {
      // เสียงเป็นของเสริม ห้ามทำให้แถบพังถ้าเบราว์เซอร์ไม่ให้เล่น
    }
  }, [enabled]);
}

export function MatchStrip({ now }: { now: Date | null }) {
  const [data, setData] = useState<StripData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [sound, setSound] = useState(false);
  /** ตำแหน่งที่ผู้ใช้ลากไปวาง — null คือยังอยู่ที่เดิมใน header */
  const [floating, setFloating] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const firedRef = useRef(new Set<string>());
  const chime = useChime(sound);

  // จำค่าที่ผู้ใช้ตั้งไว้ ไม่ต้องมาย่อและลากใหม่ทุกครั้งที่เปิดเว็บ
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as
        { collapsed?: boolean; sound?: boolean; floating?: { x: number; y: number } | null } | null;
      if (!saved) return;
      setCollapsed(Boolean(saved.collapsed));
      setSound(Boolean(saved.sound));
      setFloating(saved.floating ?? null);
    } catch {
      // ค่าที่จำไว้เสียหายก็เริ่มจากค่าเริ่มต้น ไม่ต้องทำอะไร
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapsed, sound, floating }));
    } catch {
      // เบราว์เซอร์ปิด storage ไว้ — แถบยังทำงานได้ แค่ไม่จำค่า
    }
  }, [collapsed, sound, floating]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/match-strip")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: (StripData & { ok?: boolean }) | null) => {
          if (!alive || !payload?.ok) return;
          setData({
            match: payload.match ?? null,
            conditions: payload.conditions ?? null,
            nextMatch: payload.nextMatch ?? null,
            latestStory: payload.latestStory ?? null,
          });
        })
        .catch(() => undefined);
    };
    window.queueMicrotask(load);
    const timer = window.setInterval(load, 5 * 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const match = data?.match ?? null;
  const conditions = data?.conditions ?? null;

  const clock = useMemo(() => {
    if (!match || !now) return null;
    const kickoff = new Date(match.kickoffUtc).getTime();
    const elapsedMinutes = (now.getTime() - kickoff) / 60_000;
    return {
      elapsedMinutes,
      phase: phaseOf(elapsedMinutes),
      untilKickoff: kickoff - now.getTime(),
      progress: Math.min(1, Math.max(0, elapsedMinutes / MATCH_WINDOW_MINUTES)),
    };
  }, [match, now]);

  // เตือนตามจังหวะของเกม — ยิงครั้งเดียวต่อนัด กันเตือนซ้ำทุกวินาที
  useEffect(() => {
    if (!clock || !match) return;
    const fire = (id: string, pattern: number[]) => {
      const key = `${match.key}:${id}`;
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      chime(pattern);
    };
    const { elapsedMinutes } = clock;
    if (elapsedMinutes >= -PREMATCH_ALERT_MINUTES && elapsedMinutes < 0) fire("soon", [740, 880]);
    if (elapsedMinutes >= 0 && elapsedMinutes < 1) fire("kickoff", [660, 880, 1040]);
    if (elapsedMinutes >= FIRST_HALF_END && elapsedMinutes < FIRST_HALF_END + 1) fire("half", [880, 660]);
    if (elapsedMinutes >= FULL_TIME_MINUTES && elapsedMinutes < FULL_TIME_MINUTES + 1) fire("full", [1040, 880, 660]);
  }, [clock, match, chime]);

  const onPointerDown = (event: React.PointerEvent) => {
    const host = (event.currentTarget as HTMLElement).closest(".match-strip") as HTMLElement | null;
    if (!host) return;
    const box = host.getBoundingClientRect();
    dragRef.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setFloating({
      x: Math.max(4, Math.min(window.innerWidth - 120, event.clientX - drag.dx)),
      y: Math.max(4, Math.min(window.innerHeight - 60, event.clientY - drag.dy)),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  if (!match) return null;

  const live = clock !== null && clock.elapsedMinutes >= 0 && clock.elapsedMinutes < MATCH_WINDOW_MINUTES;
  const halfStart = (FIRST_HALF_END / MATCH_WINDOW_MINUTES) * 100;
  const halfEnd = (SECOND_HALF_START / MATCH_WINDOW_MINUTES) * 100;
  const postMatch = clock !== null
    && clock.elapsedMinutes >= FULL_TIME_MINUTES
    && clock.elapsedMinutes < FULL_TIME_MINUTES + POST_MATCH_WINDOW_MINUTES;
  const opponent = match.home === "Manchester United" ? match.away : match.home;

  return (
    <section
      className={`match-strip${live ? " is-live" : ""}${collapsed ? " collapsed" : ""}${floating ? " floating" : ""}`}
      style={floating ? { left: floating.x, top: floating.y } : undefined}
      aria-label="นัดถัดไปและสภาพอากาศที่สนาม"
    >
      <div className="match-strip-controls">
        <button
          type="button"
          className="strip-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={() => setFloating(null)}
          title="ลากเพื่อย้ายแถบ · ดับเบิลคลิกเพื่อกลับที่เดิม"
          aria-label="ย้ายตำแหน่งแถบ"
        >
          <GripVertical size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`strip-sound${sound ? " on" : ""}`}
          onClick={() => { setSound((value) => !value); if (!sound) chime([880]); }}
          title={sound ? "ปิดเสียงเตือน" : "เปิดเสียงเตือนก่อนเตะ พักครึ่ง และจบเกม"}
          aria-pressed={sound}
        >
          {sound ? <Bell size={12} aria-hidden="true" /> : <BellOff size={12} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="strip-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          title={collapsed ? "ขยายแถบ" : "ย่อแถบ"}
        >
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="match-strip-teams">
        <span className="team-chip home" aria-hidden="true">{match.homeCode}</span>
        <b>{thaiName(match.home)}</b>
        {/* ช่องสกอร์ — ยังไม่มีสกอร์สดในแพ็กฟรี จึงขึ้นขีดไว้และบอกเหตุผลใน title
            ไม่ใช่แสดง 0-0 ซึ่งอ่านแล้วเข้าใจว่าเสมออยู่จริง */}
        <span className="match-score" title="แพ็กฟรีของผู้ให้บริการไม่มีสกอร์ระหว่างเกม">
          <b>–</b><i>:</i><b>–</b>
        </span>
        <b>{thaiName(match.away)}</b>
        <span className="team-chip away" aria-hidden="true">{match.awayCode}</span>
      </div>

      <div className="match-strip-meta">
        <span className={`match-tag ${match.competition}`}>
          {match.competition === "friendly" ? "อุ่นเครื่อง" : "พรีเมียร์ลีก"}
        </span>
        <span>{match.stadium} · {match.city}</span>
        {match.broadcaster && <span className="match-broadcaster"><Radio size={11} aria-hidden="true" />{match.broadcaster}</span>}
      </div>

      <div className="match-strip-timeline">
        <header>
          {clock === null
            ? <b>กำลังอ่านเวลา…</b>
            : live
              ? <b className="live-label">{clock.phase.label}</b>
              : clock.phase.key === "done"
                ? <b>จบเกมแล้ว</b>
                : <b className="count-label">จะเตะอีก <em aria-hidden="true">−</em>{countdown(clock.untilKickoff)}</b>}
          <small>
            เขี่ยบอล {dayTimeAt(match.kickoffUtc, "Asia/Bangkok")} น. ไทย · {dayTimeAt(match.kickoffUtc, "Europe/London")} น. อังกฤษ
          </small>
        </header>

        <div
          className="match-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((clock?.progress ?? 0) * 100)}
          aria-label="ความคืบหน้าของเกมโดยประมาณ"
        >
          <i className="match-progress-half" style={{ left: `${halfStart}%`, width: `${halfEnd - halfStart}%` }} />
          <i className="match-progress-fill" style={{ width: `${(clock?.progress ?? 0) * 100}%` }} />
          <i className="match-progress-pin" style={{ left: `${(clock?.progress ?? 0) * 100}%` }} />
        </div>

        {/* เวลาที่คาดว่าจะถึงแต่ละจุด ทั้งสองโซนเวลา — คนดูจะได้กะเวลาตัวเองถูก
            ทุกค่าคิดจากเวลาเตะบวกนาทีมาตรฐาน จึงเป็นค่าประมาณ เขียนกำกับไว้แล้ว */}
        <footer className="match-progress-marks">
          <span>
            <em>เขี่ยบอล</em>
            {clockAt(match.kickoffUtc, 0, "Asia/Bangkok")} · {clockAt(match.kickoffUtc, 0, "Europe/London")}
          </span>
          <span>
            <em>พักครึ่ง ~</em>
            {clockAt(match.kickoffUtc, FIRST_HALF_END, "Asia/Bangkok")} · {clockAt(match.kickoffUtc, FIRST_HALF_END, "Europe/London")}
          </span>
          <span>
            <em>จบเกม ~</em>
            {clockAt(match.kickoffUtc, FULL_TIME_MINUTES, "Asia/Bangkok")} · {clockAt(match.kickoffUtc, FULL_TIME_MINUTES, "Europe/London")}
          </span>
        </footer>
        <p className="match-progress-hint">เวลาไทย · เวลาอังกฤษ — พักครึ่งและจบเกมเป็นเวลาประมาณ ยังไม่รวมเวลาทดเจ็บ</p>
      </div>

      {conditions && (
        <div className="match-strip-weather" title={`วัดเมื่อ ${conditions.observedAt} ตามเวลาสนาม`}>
          {/* เขียนชื่อสนามกำกับไว้ เพราะตัวเลขลอย ๆ ทำให้เข้าใจผิดว่าเป็นอากาศกรุงเทพ
              ค่าทุกตัวมาจากพิกัดของสนามที่จะเตะนัดนี้ ไม่ใช่เมืองของคนอ่าน */}
          <span className="weather-venue">ที่ {match.stadium}</span>
          <span className="weather-main">
            <CloudSun size={13} aria-hidden="true" />
            <b>{conditions.temperatureC}°</b>
            <small>รู้สึก {conditions.feelsLikeC}° · {conditions.summary}</small>
          </span>
          <span className="weather-item">
            <Wind size={11} aria-hidden="true" />{conditions.windKph} กม./ชม.
          </span>
          {conditions.pm25 !== null && (
            <span className={`weather-item air${conditions.pm25 > 37.5 ? " warn" : ""}`}>
              PM2.5 {conditions.pm25}
              <small>{conditions.airLabel}</small>
            </span>
          )}
        </div>
      )}

      {/* ── ข่าวล่าสุดที่เพิ่งเข้าระบบ ─────────────────────────────────────
          ผูกกับคลังข่าวเดียวกับฟีดหน้าแรก จึงขยับเองทุกรอบซิงก์ (ทุก 10 นาที)
          ต้องมีชื่อสำนักข่าวติดมาด้วยเสมอ พาดหัวลอย ๆ ที่ไม่บอกที่มาคือข่าวลือ */}
      {data?.latestStory && (
        <div className="match-strip-news">
          <span className="news-flag">ข่าวเข้าใหม่</span>
          <b>{data.latestStory.titleTh}</b>
          <small>{data.latestStory.source}</small>
        </div>
      )}

      <div className="match-strip-links">
        {postMatch && (
          <a className="strip-live-cta" href={FOOTBALL_GENIUS_STREAMS} target="_blank" rel="noreferrer">
            <Tv size={12} aria-hidden="true" />ดูไลฟ์หลังเกม FOOTBALL GENIUS
          </a>
        )}
        {data?.nextMatch && (
          <span className="strip-next">
            นัดต่อไป · {thaiName(data.nextMatch.home)} พบ {thaiName(data.nextMatch.away)}
            <small>{dayTimeAt(data.nextMatch.kickoffUtc, "Asia/Bangkok")} น. ไทย</small>
          </span>
        )}
      </div>

      {/* ── รายชื่อนักเตะวิ่ง ────────────────────────────────────────────────
          ฝั่งแมนยูมาจากรายชื่อชุดใหญ่ทางการใน config/mu-squad.ts จึงอัปเดตเอง
          ฝั่งคู่แข่งยังไม่มีข้อมูล และจะไม่เดาให้ครบช่อง ตามกติกาใน capabilities.ts */}
      <div className="match-strip-squads">
        <div className="squad-run">
          <span className="squad-side"><i className="team-chip home">MU</i>{thaiName("Manchester United")}</span>
          <Marquee duration={64}>
            {MU_FIRST_TEAM_SQUAD.map((player) => (
              <span className="squad-player" key={player.id}>
                <b>{player.number}</b>
                {player.name}
                <small>{POSITION_TH[player.position]}</small>
              </span>
            ))}
          </Marquee>
        </div>
        <div className="squad-run empty">
          <span className="squad-side">
            <i className="team-chip away">{match.home === "Manchester United" ? match.awayCode : match.homeCode}</i>
            {thaiName(opponent)}
          </span>
          <p>
            ยังไม่มีรายชื่อนักเตะของคู่แข่งในระบบ — ต้องใช้ข้อมูลไลน์อัพจากผู้ให้บริการแบบเสียเงิน
            พอต่อได้เมื่อไหร่ แถบนี้จะขึ้นเองทั้งสองฝั่งพร้อมตัวจริงของนัดนั้นจริง ๆ
          </p>
        </div>
      </div>
    </section>
  );
}
