// รหัสรายการแข่งของแต่ละผู้ให้บริการ (STEP 12, 13)
// ---------------------------------------------------------------------------
// แต่ละเจ้าเรียกพรีเมียร์ลีกด้วยรหัสคนละแบบ
//   API-Football        league=39
//   football-data.org   competitions/PL
// ถ้าส่งรหัสเดียวกันไปให้ทุกเจ้า จะมีเจ้าหนึ่งตอบ error เสมอ
//
// แอปใช้ id ของ GOG เป็นหลัก แล้วแปลงเป็นรหัสของผู้ให้บริการตอนจะยิงเท่านั้น
// เพิ่มรายการใหม่ทีหลังก็แค่เติมในตารางนี้ ไม่ต้องแก้ adapter หรือหน้าเว็บ

import type { ProviderId } from "@/services/football/types";

export type GogCompetition = {
  id: string;
  name: string;
  nameTh: string;
  country: string;
  providerCodes: Partial<Record<ProviderId, string>>;
};

export const COMPETITIONS: readonly GogCompetition[] = [
  {
    id: "premier-league",
    name: "Premier League",
    nameTh: "พรีเมียร์ลีก",
    country: "England",
    providerCodes: {
      api_football: "39",
      football_data: "PL",
      gog_demo: "premier-league",
    },
  },
];

export const DEFAULT_COMPETITION_ID = "premier-league";

/**
 * ฤดูกาลปัจจุบัน — ทั้งสองเจ้าใช้ปีที่ฤดูกาลเริ่ม (2026 = ฤดูกาล 2026/27)
 *
 * ทดสอบเมื่อ 11 ส.ค. 2026: แพ็กฟรีของ API-Football เข้าถึงฤดูกาลนี้ไม่ได้
 * ("Free plans do not have access to this season, try from 2022 to 2024")
 * ปฏิทินและตารางคะแนนจึงมาจาก football-data.org เจ้าเดียว
 * ส่วนเหตุการณ์ ไลน์อัพ และสถิติยังไม่มีข้อมูล ซึ่งหน้าเว็บขึ้นสถานะให้ถูกต้องแล้ว
 *
 * อยากทดสอบท่อเหตุการณ์/ไลน์อัพ/สถิติกับข้อมูลจริงโดยไม่เสียเงิน
 * ให้เปลี่ยนค่านี้เป็น "2023" ชั่วคราว แล้วล้าง football_cache
 * รายละเอียดทั้งหมดอยู่ใน docs/FOOTBALL-DATA.md
 */
export const DEFAULT_SEASON = "2026";

export function competitionById(id: string) {
  return COMPETITIONS.find((entry) => entry.id === id) ?? null;
}

/**
 * แปลง id ของ GOG เป็นรหัสที่ผู้ให้บริการรายนั้นเข้าใจ
 * ไม่มีในตาราง = ผู้ให้บริการรายนั้นไม่รองรับรายการนี้ คืน null ให้ผู้เรียกข้ามไป
 */
export function providerCompetitionCode(competitionId: string, provider: ProviderId): string | null {
  return competitionById(competitionId)?.providerCodes[provider] ?? null;
}
