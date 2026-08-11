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

/** ฤดูกาลปัจจุบัน — ทั้งสองเจ้าใช้ปีที่ฤดูกาลเริ่ม (2026 = ฤดูกาล 2026/27) */
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
