// อะแดปเตอร์ข้อมูลโปรแกรมแข่ง
// ตอนนี้อ่านจากไฟล์ config ที่ตรวจกับโปรแกรมทางการแล้ว วันหน้าถ้าต่อ football API
// ให้เปลี่ยนเฉพาะข้างในไฟล์นี้ UI ไม่ต้องแก้ (STEP 31)

import { MU_PREMIER_LEAGUE_FIXTURES, type MuFixture } from "@/config/mu-fixtures";
import type { DestinationCity, TripLength } from "@/services/trip/types";

export type PlannableFixture = MuFixture & {
  /** คีย์ที่ใช้อ้างอิงในฟอร์ม/URL — matchday + วันเตะ */
  key: string;
  isHome: boolean;
  opponent: string;
  /** เมืองฐานที่บินลงและใช้เป็นที่พักตลอดทริป */
  destination: DestinationCity;
  /** true = สนามไม่ได้อยู่ในเมืองฐาน ต้องนั่งรถไฟไปกลับในวันแข่ง */
  railDay: boolean;
  /** ชื่อเมืองที่สนามตั้งอยู่จริง — ใช้บอกผู้ใช้ว่าต้องเดินทางต่อไปไหน */
  venueCity: string;
};

/** สนามในลอนดอนใช้ลอนดอนเป็นฐาน — ที่เหลือทั้งประเทศบินลงแมนเชสเตอร์แล้วต่อรถไฟ */
const LONDON_CITIES = new Set(["London"]);

function destinationOf(fixture: MuFixture): DestinationCity {
  return LONDON_CITIES.has(fixture.city) ? "London" : "Manchester";
}

export function fixtureKey(fixture: MuFixture) {
  return `${fixture.matchday}-${fixture.kickoffUtc.slice(0, 10)}`;
}

export function toPlannable(fixture: MuFixture): PlannableFixture {
  const isHome = fixture.home === "Manchester United";
  const destination = destinationOf(fixture);
  return {
    ...fixture,
    key: fixtureKey(fixture),
    isHome,
    opponent: isHome ? fixture.away : fixture.home,
    destination,
    railDay: fixture.city !== destination,
    venueCity: fixture.city,
  };
}

/**
 * นัดที่วางแผนเดินทางได้ = ทุกนัดที่ยังไม่เตะ
 * สนามนอกแมนเชสเตอร์/ลอนดอนไม่ถูกตัดทิ้งแล้ว — บินลงเมืองฐานแล้วนั่งรถไฟไปวันแข่ง
 * (ระยะเวลาและเส้นทางรถไฟอยู่ใน config/stadium-travel.ts ครบทั้ง 20 สนาม)
 */
export function listPlannableFixtures(now = Date.now()) {
  return MU_PREMIER_LEAGUE_FIXTURES
    .map(toPlannable)
    .filter((fixture) => new Date(fixture.kickoffUtc).getTime() > now);
}

export function listAllPlannable() {
  return MU_PREMIER_LEAGUE_FIXTURES.map(toPlannable);
}

export function findFixture(key: string) {
  return listAllPlannable().find((fixture) => fixture.key === key) ?? null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * แนะนำวันเดินทางรอบวันแข่ง (STEP 2)
 * กติกา: ต้องถึงอังกฤษก่อนวันแข่งอย่างน้อย 1 วันเต็ม เพราะบิน BKK→UK ใช้เวลา ~12-14 ชม.
 *        ทริป 5 วันวางวันแข่งไว้กลาง ๆ · ทริป 8 วันเผื่อวันเที่ยว/ไปเมืองอื่นหลังเกม
 */
export function recommendTripDates(kickoffUtc: string, length: TripLength) {
  const matchDay = new Date(`${kickoffUtc.slice(0, 10)}T00:00:00Z`);
  // ต้องถึงอังกฤษก่อนวันแข่งอย่างน้อย 2 วัน (บิน 1 คืน + พักปรับเจ็ตแล็ก 1 วันเต็ม)
  // ของเดิมทริป 5 วันออกก่อนแข่ง 2 วัน = ถึงก่อนแข่งแค่วันเดียว ซึ่งไปชนคำเตือนของระบบเองทุกครั้ง
  const daysBefore = length === 5 ? 3 : length === 8 ? 4 : 5;
  const depart = addDays(matchDay, -daysBefore);
  const back = addDays(depart, length - 1);
  return { departDate: ymd(depart), returnDate: ymd(back), matchDate: ymd(matchDay) };
}

/** จำนวนคืนที่ต้องจองโรงแรม — ออกจากกรุงเทพวันแรก ถึงอังกฤษเช้าวันถัดไป */
export function hotelNights(length: TripLength) {
  return length - 1;
}
