// โหมดเพื่อนคู่ใจวันแข่ง (STEP 77)
// ---------------------------------------------------------------------------
// ตอนวางแผนที่บ้าน แผนเที่ยวทั้งทริปคือสิ่งที่อยากเห็น
// แต่ตอนยืนอยู่กลางแมนเชสเตอร์ตีสี่ตามเวลาไทย สิ่งที่อยากรู้มีอย่างเดียว
// "ตอนนี้ควรทำอะไร แล้วอีกกี่นาทีต้องออกจากที่นี่"
//
// ไฟล์นี้ย่อแผนทั้งทริปให้เหลือ ตอนนี้ · ถัดไป · เส้นตายที่ห้ามพลาด
//
// เวลาทั้งหมดในไฟล์นี้เป็นเวลาอังกฤษ เพราะผู้ใช้อยู่ที่นั่นแล้ว
// การแสดงเวลาไทยตอนที่คนยืนอยู่หน้าสนามคือสิ่งที่ทำให้พลาดรถราง

import { gogStadium } from "@/config/gog-stadiums";
import type { ItineraryDay, ItineraryItem } from "@/services/itinerary";
import type { MatchWeather } from "@/services/weather";

export const COMPANION_VERSION = "1.0.0";

export type CompanionStatus = "before_trip" | "on_trip" | "matchday" | "after_trip";

export type CompanionAlert = {
  level: "urgent" | "warn" | "info";
  text: string;
};

export type CompanionView = {
  status: CompanionStatus;
  /** วันที่ในทริปที่กำลังแสดง — null เมื่อยังไม่เริ่มหรือจบทริปแล้ว */
  day: ItineraryDay | null;
  /** รายการที่กำลังอยู่ในช่วงเวลานี้ */
  now: ItineraryItem | null;
  /** รายการถัดไป และเหลืออีกกี่นาที */
  next: { item: ItineraryItem; inMinutes: number } | null;
  /** สิ่งที่พลาดไม่ได้ในวันนี้ เช่น เวลาออกไปสนาม */
  deadlines: Array<{ item: ItineraryItem; inMinutes: number }>;
  alerts: CompanionAlert[];
  /** ข้อมูลสนามสำหรับวันแข่ง */
  stadium: ReturnType<typeof gogStadium>;
  version: string;
};

/** นาทีตั้งแต่เที่ยงคืนของ "HH:MM" — คืน null เมื่อรูปแบบไม่ใช่เวลา */
function minutesOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

/**
 * รายการที่ "กำลังทำอยู่" คือรายการที่เริ่มไปแล้วและยังไม่ครบเวลาที่กำหนดไว้
 * ถ้าเลยเวลาของทุกรายการแล้ว ให้ถือว่าจบวันแล้ว ไม่ใช่ค้างที่รายการสุดท้ายตลอดไป
 */
function splitByTime(items: ItineraryItem[], nowMinutes: number) {
  const timed = items
    .map((item) => ({ item, start: minutesOf(item.time) }))
    .filter((entry): entry is { item: ItineraryItem; start: number } => entry.start !== null)
    .sort((a, b) => a.start - b.start);

  let current: ItineraryItem | null = null;
  let next: { item: ItineraryItem; inMinutes: number } | null = null;

  for (const entry of timed) {
    const end = entry.start + Math.max(entry.item.durationMinutes, 0);
    if (nowMinutes >= entry.start && nowMinutes < end) current = entry.item;
    if (entry.start > nowMinutes && !next) next = { item: entry.item, inMinutes: entry.start - nowMinutes };
  }

  const deadlines = timed
    .filter((entry) => entry.item.highlight && entry.start > nowMinutes)
    .map((entry) => ({ item: entry.item, inMinutes: entry.start - nowMinutes }));

  return { current, next, deadlines };
}

function weatherAlerts(weather: MatchWeather | null): CompanionAlert[] {
  if (!weather) return [];
  const alerts: CompanionAlert[] = [];
  if (weather.rainChance >= 50) {
    alerts.push({ level: "warn", text: `โอกาสฝนตก ${weather.rainChance}% — สนามส่วนใหญ่ไม่ให้เอาร่มเข้า เอาเสื้อกันฝนมีฮู้ดไป` });
  }
  if (weather.maxC <= 6) {
    alerts.push({ level: "warn", text: `วันนี้สูงสุด ${weather.maxC}°C — นั่งบนอัฒจันทร์สองชั่วโมงหนาวกว่าตัวเลขมาก ใส่ให้อุ่นกว่าที่คิด` });
  }
  if (weather.windKph >= 35) {
    alerts.push({ level: "info", text: `ลม ${weather.windKph} กม./ชม. — จะรู้สึกเย็นกว่าอุณหภูมิจริง` });
  }
  return alerts;
}

/**
 * ประกอบมุมมอง "ตอนนี้ควรทำอะไร"
 *
 * nowIso ต้องเป็นเวลาปัจจุบันจริง และ ukDate/ukMinutes คือเวลาอังกฤษที่ผู้เรียก
 * คำนวณมาแล้ว — ไม่คำนวณเขตเวลาในนี้ เพราะ Europe/London มี DST
 * การบวกลบชั่วโมงเองจะผิดปีละสองครั้ง ต้องให้ Intl จัดการเท่านั้น
 */
export function buildCompanionView(input: {
  itinerary: ItineraryDay[];
  ukDate: string;
  ukMinutes: number;
  matchDate: string;
  kickoffUtc: string | null;
  venueName: string | null;
  weather: MatchWeather | null;
}): CompanionView {
  const { itinerary, ukDate, ukMinutes } = input;
  const stadium = gogStadium(input.venueName ?? undefined);
  const base = { stadium, version: COMPANION_VERSION };

  if (itinerary.length === 0) {
    return { ...base, status: "before_trip", day: null, now: null, next: null, deadlines: [], alerts: [] };
  }

  const first = itinerary[0].date;
  const last = itinerary[itinerary.length - 1].date;
  if (ukDate < first) {
    const daysToGo = Math.round((new Date(`${first}T00:00:00Z`).getTime() - new Date(`${ukDate}T00:00:00Z`).getTime()) / 86_400_000);
    return {
      ...base,
      status: "before_trip", day: null, now: null, next: null, deadlines: [],
      alerts: [{ level: "info", text: `ยังไม่ถึงวันเดินทาง — อีก ${daysToGo} วันออกจากกรุงเทพฯ` }],
    };
  }
  if (ukDate > last) {
    return {
      ...base,
      status: "after_trip", day: null, now: null, next: null, deadlines: [],
      alerts: [{ level: "info", text: "ทริปนี้จบแล้ว — วางแผนนัดต่อไปได้เลย" }],
    };
  }

  const day = itinerary.find((entry) => entry.date === ukDate) ?? null;
  if (!day) {
    return { ...base, status: "on_trip", day: null, now: null, next: null, deadlines: [], alerts: [] };
  }

  const { current, next, deadlines } = splitByTime(day.items, ukMinutes);
  const isMatchday = ukDate === input.matchDate;
  const alerts: CompanionAlert[] = [];

  if (isMatchday) {
    alerts.push(...weatherAlerts(input.weather));

    // เส้นตายที่ใกล้ที่สุดคือสิ่งเดียวที่ควรเร่งเตือน ไม่ใช่เตือนทุกอันพร้อมกัน
    const soonest = deadlines[0];
    if (soonest && soonest.inMinutes <= 45) {
      alerts.unshift({
        level: "urgent",
        text: `อีก ${soonest.inMinutes} นาทีต้อง${soonest.item.title} — ออกเดี๋ยวนี้`,
      });
    }
    if (stadium) {
      alerts.push({ level: "info", text: `เข้าสนามทาง ${stadium.nearestStation} · ${stadium.localTransit}` });
      if (stadium.matchdayNotes) alerts.push({ level: "info", text: stadium.matchdayNotes });
    }
  }

  if (!current && !next) {
    alerts.push({ level: "info", text: "หมดรายการของวันนี้แล้ว — พักผ่อนเก็บแรงไว้พรุ่งนี้" });
  }

  return {
    ...base,
    status: isMatchday ? "matchday" : "on_trip",
    day, now: current, next, deadlines, alerts,
  };
}

/** นาทีเป็นข้อความไทยที่อ่านแล้วรู้ทันทีว่ารีบไหม */
export function inMinutesTh(minutes: number) {
  if (minutes < 1) return "เดี๋ยวนี้";
  if (minutes < 60) return `อีก ${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `อีก ${hours} ชม.` : `อีก ${hours} ชม. ${rest} นาที`;
}
