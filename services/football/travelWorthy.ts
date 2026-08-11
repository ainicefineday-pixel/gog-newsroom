// MATCHES WORTH TRAVELLING FOR (STEP 72)
// ---------------------------------------------------------------------------
// ให้คะแนนว่านัดไหนคุ้มค่าบินไปดูจากไทย โดยใช้เฉพาะสิ่งที่ตรวจสอบได้จริง
//
// สิ่งที่จงใจไม่เอามาคิด:
//   - ตั๋วเหลือเท่าไหร่ — สเปกห้ามใช้ถ้ายังไม่ได้ยืนยันจากแหล่งจริง (STEP 72)
//   - ฟอร์มทีมช่วงนั้น — ตอนวางแผนล่วงหน้าหลายเดือนยังไม่มีทางรู้
// ทุกเหตุผลที่ให้คะแนนต้องอธิบายเป็นภาษาคนได้ ไม่ใช่เลขลอย ๆ

import { gogStadium } from "@/config/gog-stadiums";
import { resolveOfficialName } from "@/services/football/thai";
import type { GOGFixture } from "@/services/football/types";

export const TRAVEL_SCORE_VERSION = "1.0.0";

/**
 * ระดับความน่าสนใจของคู่แข่ง — แยกเป็นชั้นแทนที่จะเป็นใช่/ไม่ใช่
 * ถ้าให้คะแนนก้อนเดียวเท่ากันหมด นัดใหญ่ทุกนัดจะได้ 100 เท่ากันจนเรียงลำดับไม่มีความหมาย
 */
const OPPONENT_TIER: Record<string, { points: number; label: string }> = {
  "Manchester City": { points: 30, label: "ดาร์บี้แมนเชสเตอร์ นัดที่คนทั้งเมืองรอทั้งปี" },
  Liverpool: { points: 28, label: "แดงเดือด คู่ปรับตลอดกาลของอังกฤษ" },
  "Leeds United": { points: 24, label: "War of the Roses บรรยากาศดุที่สุดคู่หนึ่ง" },
  Arsenal: { points: 22, label: "คู่ใหญ่ระดับลุ้นแชมป์" },
  Chelsea: { points: 21, label: "คู่ใหญ่ระดับลุ้นแชมป์" },
  "Tottenham Hotspur": { points: 19, label: "คู่ใหญ่ที่สนามใหม่ที่สุดในลีก" },
  "Newcastle United": { points: 16, label: "เสียงเชียร์ดังที่สุดแห่งหนึ่งของลีก" },
  "Aston Villa": { points: 14, label: "สนามคลาสสิกแบบอังกฤษดั้งเดิม" },
  Everton: { points: 13, label: "ดาร์บี้เมอร์ซีย์ไซด์อยู่ในเมืองเดียวกับแอนฟิลด์" },
};

/** เมืองที่บินลงตรงแล้วเดินทางต่อสั้นที่สุด */
const DIRECT_CITIES = new Set(["Manchester", "London"]);

export type TravelWorthiness = {
  score: number;
  /** เหตุผลที่อ่านแล้วเข้าใจว่าทำไมนัดนี้ได้คะแนนเท่านี้ */
  reasons: string[];
  tier: "must" | "good" | "optional";
  version: string;
};

/**
 * คะแนนเต็ม 100 แบ่งเป็น
 *   คู่แข่ง 30 (แบ่งเป็นชั้น) · วันเตะ 18 · เดินทางถึงสนาม 18
 *   ความจุสนาม 18 (คิดต่อเนื่องตามจำนวนที่นั่ง) · เกมเหย้า 8 · มีคู่มือสนาม 8
 *
 * ความจุคิดแบบต่อเนื่องแทนการให้เป็นก้อน เพื่อให้คะแนนกระจายจริง
 * รุ่นแรกให้เป็นก้อนแล้วนัดใหญ่ทุกนัดได้ 100 เท่ากันหมดจนเรียงลำดับไม่มีความหมาย
 */
export function travelWorthiness(fixture: GOGFixture, isHomeTeamThaiFavourite = true): TravelWorthiness {
  const reasons: string[] = [];
  let score = 0;

  const marqueeSide = isHomeTeamThaiFavourite ? fixture.away : fixture.home;
  const opponent = resolveOfficialName(marqueeSide.name) ?? marqueeSide.name;
  const tierEntry = OPPONENT_TIER[opponent];
  if (tierEntry) {
    score += tierEntry.points;
    reasons.push(`คู่กับ${marqueeSide.shortName} — ${tierEntry.label}`);
  } else {
    score += 8;
    reasons.push("คู่ทั่วไปของลีก ตั๋วหาง่ายกว่าและราคาย่อมเยากว่านัดใหญ่");
  }

  // เตะเสาร์-อาทิตย์ตามเวลาสนาม = ลางานน้อยลง
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
    .format(new Date(fixture.kickoffUtc));
  if (weekday === "Sat") {
    score += 18;
    reasons.push("เตะวันเสาร์ ต่อวันหยุดได้ลงตัวที่สุด");
  } else if (weekday === "Sun") {
    score += 15;
    reasons.push("เตะวันอาทิตย์ ลางานน้อยกว่านัดกลางสัปดาห์");
  } else {
    score += 4;
    reasons.push("เตะกลางสัปดาห์ ต้องลางานเพิ่ม");
  }

  const venueCity = fixture.venue?.city ?? "";
  if (DIRECT_CITIES.has(venueCity)) {
    score += 18;
    reasons.push(`สนามอยู่ใน${venueCity === "Manchester" ? "แมนเชสเตอร์" : "ลอนดอน"} บินลงแล้วไม่ต้องต่อรถไฟข้ามเมือง`);
  } else if (venueCity) {
    score += 7;
    reasons.push(`สนามอยู่ที่${venueCity} ต้องพักเมืองฐานแล้วนั่งรถไฟไปวันแข่ง`);
  }

  if (fixture.home.name === "Manchester United") {
    score += 8;
    reasons.push("เกมเหย้า ตั๋วฝั่งเจ้าบ้านมีมากกว่าโควตาทีมเยือน");
  }

  const stadium = gogStadium(fixture.venue?.name);
  if (stadium) {
    score += 8;
    // ไล่ระดับจาก 11,000 ถึง 75,000 ที่นั่งเป็นช่วง 0–18 คะแนน
    const span = Math.min(Math.max((stadium.capacity - 11_000) / (75_000 - 11_000), 0), 1);
    score += Math.round(span * 18);
    if (stadium.capacity >= 50_000) {
      reasons.push(`สนามความจุ ${stadium.capacity.toLocaleString("th-TH")} ที่นั่ง บรรยากาศเต็มสนาม`);
    } else if (stadium.capacity <= 20_000) {
      reasons.push(`สนามความจุแค่ ${stadium.capacity.toLocaleString("th-TH")} ที่นั่ง ตั๋วทีมเยือนจำกัดมาก`);
    }
  } else {
    reasons.push("ยังไม่มีคู่มือสนามฉบับ GOG ของสนามนี้");
  }

  const total = Math.min(score, 100);
  const tier = total >= 78 ? "must" : total >= 55 ? "good" : "optional";
  return { score: total, reasons, tier, version: TRAVEL_SCORE_VERSION };
}

export const TRAVEL_TIER_LABEL: Record<TravelWorthiness["tier"], string> = {
  must: "คุ้มค่าบินไปดู",
  good: "น่าไปถ้าวันตรง",
  optional: "ไว้เป็นตัวเลือกสำรอง",
};
