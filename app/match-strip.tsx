"use client";

// แถบนัดถัดไปบน nav — นับถอยหลัง เส้นเวลาเกม และสภาพอากาศที่สนาม
// ---------------------------------------------------------------------------
// ทุกอย่างบนแถบนี้คำนวณจากเวลาเตะจริงในปฏิทินกับค่าที่ขอมาสด ๆ ไม่มีค่าประดับ
//
// เส้นเวลาเกมเป็น "เส้นตามเวลาที่ผ่านไป" ไม่ใช่นาฬิกาแมตช์ของจริง
// เพราะผู้ให้บริการแพ็กฟรีไม่มีข้อมูลสดระดับนาที (ดู docs/FOOTBALL-DATA.md)
// จึงเขียนกำกับไว้บนแถบตรง ๆ ว่าเป็นเวลาโดยประมาณ ไม่ใช่ทำเนียนว่ารู้นาทีจริง
//
// เรื่องตราสโมสร: ใช้อักษรย่อสามตัวบนชิปสีแทนโลโก้จริง เพราะตราสโมสรเป็น
// เครื่องหมายการค้าที่มีเจ้าของ การดึงไฟล์โลโก้จาก API มาแสดงไม่ได้แปลว่า
// ได้สิทธิ์ใช้ (บันทึกไว้แล้วใน docs/FOOTBALL-DATA.md ข้อ 3) และเว็บนี้มีแผนขายทริป
// จึงเป็นการใช้เชิงพาณิชย์เต็มตัว ถ้าวันหนึ่งได้สิทธิ์มาแล้วค่อยสลับชิปเป็นรูปได้เลย

import { useEffect, useMemo, useState } from "react";
import { CloudSun, Radio, Wind } from "lucide-react";
import { TEAM_NAMES } from "@/services/football/thai";
import {
  FIRST_HALF_END, MATCH_WINDOW_MINUTES, SECOND_HALF_START, type NavMatch,
} from "@/services/football/next-match";
import type { VenueConditions } from "@/services/weather";

type StripData = { match: NavMatch | null; conditions: VenueConditions | null };

const thaiName = (club: string) => TEAM_NAMES[club]?.short ?? club;

/** ขั้นของเกม คำนวณจากเวลาที่ผ่านไปหลังเขี่ยบอลเท่านั้น */
function phaseOf(elapsedMinutes: number) {
  if (elapsedMinutes < 0) return { key: "upcoming" as const, label: "ยังไม่เริ่ม" };
  if (elapsedMinutes < FIRST_HALF_END) {
    return { key: "first" as const, label: `ครึ่งแรก · ราวนาทีที่ ${Math.floor(elapsedMinutes) + 1}` };
  }
  if (elapsedMinutes < SECOND_HALF_START) return { key: "half" as const, label: "พักครึ่ง" };
  if (elapsedMinutes < 105) {
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

/** เวลาเตะในสองโซนเวลา — คนไทยดูจากเวลาไทย แต่ต้องรู้เวลาอังกฤษด้วยตอนคุยกับข่าว */
function kickoffLabel(kickoffUtc: string, timeZone: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(kickoffUtc));
}

export function MatchStrip({ now }: { now: Date | null }) {
  const [data, setData] = useState<StripData | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/match-strip")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { ok?: boolean; match?: NavMatch | null; conditions?: VenueConditions | null } | null) => {
          if (!alive || !payload?.ok) return;
          setData({ match: payload.match ?? null, conditions: payload.conditions ?? null });
        })
        .catch(() => undefined);
    };
    window.queueMicrotask(load);
    // ค่าอากาศของ Open-Meteo ขยับทุก 15 นาที ถามถี่กว่านั้นได้ค่าเดิม
    const timer = window.setInterval(load, 10 * 60_000);
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

  if (!match) return null;

  const live = clock !== null && clock.elapsedMinutes >= 0 && clock.elapsedMinutes < MATCH_WINDOW_MINUTES;
  const halfStart = (FIRST_HALF_END / MATCH_WINDOW_MINUTES) * 100;
  const halfEnd = (SECOND_HALF_START / MATCH_WINDOW_MINUTES) * 100;

  return (
    <section className={`match-strip${live ? " is-live" : ""}`} aria-label="นัดถัดไปและสภาพอากาศที่สนาม">
      <div className="match-strip-teams">
        <span className="team-chip home" aria-hidden="true">{match.homeCode}</span>
        <b>{thaiName(match.home)}</b>
        <em>พบ</em>
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
                : <b>เตะอีก {countdown(clock.untilKickoff)}</b>}
          <small>
            {kickoffLabel(match.kickoffUtc, "Asia/Bangkok")} น. ไทย · {kickoffLabel(match.kickoffUtc, "Europe/London")} น. อังกฤษ
          </small>
        </header>

        {/* เส้นจากเขี่ยบอลถึงจบเกม พร้อมแถบพักครึ่งและหัวหมุดตามเวลาที่ผ่านไป */}
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
        <footer>
          <span>เขี่ยบอล</span>
          <span className="match-progress-note">พักครึ่ง</span>
          <span>จบเกม</span>
        </footer>
      </div>

      {conditions && (
        <div className="match-strip-weather" title={`วัดเมื่อ ${conditions.observedAt} ตามเวลาสนาม`}>
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
    </section>
  );
}
