// นัดที่แถบบน nav ต้องพูดถึงตอนนี้
// ---------------------------------------------------------------------------
// รวมปฏิทินลีกกับนัดอุ่นเครื่องเข้าด้วยกัน แล้วตอบว่า "ตอนนี้ควรโชว์นัดไหน"
//   กำลังเตะอยู่   โชว์นัดนั้นจนจบ ไม่ข้ามไปนัดถัดไปทั้งที่เกมยังไม่จบ
//   ยังไม่เตะ      โชว์นัดที่ใกล้ที่สุด
//   หมดฤดูกาล     คืน null ให้ UI ซ่อนแถบไปเลย ไม่ใช่โชว์กล่องว่าง

import { MU_PREMIER_LEAGUE_FIXTURES, type MuFixture } from "@/config/mu-fixtures";
import { MU_FRIENDLIES } from "@/config/mu-friendlies";
import { STADIUM_LOCATIONS } from "@/config/stadium-locations";
import { pickFinishedMatch } from "@/services/football/post-match";

/**
 * นาทีหลังเขี่ยบอลที่ยังถือว่าเกมยังไม่จบ
 * 45 + 15 พักครึ่ง + 45 + เผื่อทดเวลาและพิธีการอีก 15 = 120
 * ไม่ได้ผูกกับนาฬิกาจริงของแมตช์เพราะแพ็กฟรีไม่มีข้อมูลสด — ดูหมายเหตุใน types
 */
export const MATCH_WINDOW_MINUTES = 120;
/** นาทีที่ครึ่งแรกจบ และนาทีที่ครึ่งหลังเริ่ม นับจากเขี่ยบอล */
export const FIRST_HALF_END = 45;
export const SECOND_HALF_START = 60;

/** พิกัดสนามที่ไม่ได้อยู่ในลีก (นัดอุ่นเครื่อง) — สนามลีกทั้ง 20 อ่านจาก STADIUM_LOCATIONS */
const EXTRA_VENUES: Record<string, { latitude: number; longitude: number }> = {
  "Croke Park": { latitude: 53.3607, longitude: -6.2511 },
};

export type NavMatch = {
  key: string;
  kickoffUtc: string;
  home: string;
  away: string;
  /** อักษรย่อสามตัวของสโมสร ใช้ทำตราแบบไม่ต้องใช้โลโก้จริง */
  homeCode: string;
  awayCode: string;
  stadium: string;
  city: string;
  competition: "friendly" | "premier-league";
  broadcaster?: string;
  /** พิกัดสนาม — null เมื่อไม่รู้จักสนามนั้น แล้วแถบจะไม่โชว์อากาศ ไม่ใช่เดาพิกัด */
  latitude: number | null;
  longitude: number | null;
};

function codeFor(club: string) {
  const hit = STADIUM_LOCATIONS.find((entry) => entry.club === club);
  if (hit) return hit.code;
  // ทีมนอกลีก — ย่อจากชื่อเอง ตัดคำบอกประเภทสโมสรออกก่อนเพื่อไม่ให้ได้ FC
  const words = club.replace(/\b(fc|afc|united|city|hotspur|albion|county|town|wanderers)\b/gi, "").trim().split(/\s+/);
  const letters = words.join("").toUpperCase();
  return (letters.slice(0, 3) || club.slice(0, 3).toUpperCase());
}

function venueOf(fixture: MuFixture) {
  const byStadium = STADIUM_LOCATIONS.find((entry) => entry.stadium === fixture.stadium);
  if (byStadium) return { latitude: byStadium.latitude, longitude: byStadium.longitude };
  return EXTRA_VENUES[fixture.stadium] ?? null;
}

function toNavMatch(fixture: MuFixture, competition: NavMatch["competition"]): NavMatch {
  const venue = venueOf(fixture);
  return {
    key: `${competition}-${fixture.kickoffUtc.slice(0, 10)}-${fixture.matchday}`,
    kickoffUtc: fixture.kickoffUtc,
    home: fixture.home,
    away: fixture.away,
    homeCode: codeFor(fixture.home),
    awayCode: codeFor(fixture.away),
    stadium: fixture.stadium,
    city: fixture.city,
    competition,
    broadcaster: fixture.broadcaster,
    latitude: venue?.latitude ?? null,
    longitude: venue?.longitude ?? null,
  };
}

/** ทุกนัดที่แถบมองเห็น เรียงตามเวลาเตะ */
export function allNavMatches(): NavMatch[] {
  return [
    ...MU_FRIENDLIES.map((fixture) => toNavMatch(fixture, "friendly")),
    ...MU_PREMIER_LEAGUE_FIXTURES.map((fixture) => toNavMatch(fixture, "premier-league")),
  ].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
}

/**
 * นัดที่ควรโชว์ตอนนี้
 * นัดที่กำลังเตะชนะเสมอ แม้จะมีอีกนัดจ่ออยู่ก็ตาม เพราะคนดูสนใจเกมตรงหน้ามากกว่า
 */
export function currentNavMatch(now = Date.now()): NavMatch | null {
  const matches = allNavMatches();
  const live = matches.find((match) => {
    const kickoff = new Date(match.kickoffUtc).getTime();
    return now >= kickoff && now < kickoff + MATCH_WINDOW_MINUTES * 60_000;
  });
  if (live) return live;
  return matches.find((match) => new Date(match.kickoffUtc).getTime() > now) ?? null;
}

/**
 * เส้นเวลาหลังเกมอยู่ที่ services/football/post-match — ส่งต่อจากที่นี่เหมือนเดิม
 * เพื่อไม่ต้องไล่แก้ที่เรียกใช้ทุกจุด และให้ทั้งระบบยังใช้ค่าชุดเดียวกันอยู่
 */
export { FULL_TIME_MINUTES, POST_MATCH_WINDOW_MINUTES } from "@/services/football/post-match";

/**
 * นัดที่เพิ่งจบไปภายในกี่นาทีก็ตามที่ขอมา — คืน null เมื่อไม่มีนัดไหนอยู่ในช่วงนั้น
 *
 * currentNavMatch ใช้ตอบเรื่องนี้ไม่ได้ เพราะมันเลิกชี้ที่นัดเดิมตั้งแต่นาทีที่ 120
 * แล้วข้ามไปชี้นัดถัดไปทันที ใครเอาไปคิด "ผ่านมากี่นาทีตั้งแต่เขี่ยบอล" ในช่วงหลังเกม
 * จะได้ค่าติดลบของนัดหน้าโดยไม่รู้ตัว หน้าต่างหลังเกมจึงปิดตั้งแต่นาทีที่ 120
 * ทั้งที่ตั้งใจให้ยาวถึง 135 — งานหลังเกมที่พึ่งค่านี้จึงพลาดของจริงไปเงียบ ๆ
 */
export function finishedNavMatch(windowMinutes: number, now = Date.now()): NavMatch | null {
  return pickFinishedMatch(allNavMatches(), windowMinutes, now);
}
