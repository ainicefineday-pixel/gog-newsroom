// ตรวจว่าแมตช์นี้มีข้อมูลอะไรจริงบ้าง (STEP 17, 114, 115)
// ---------------------------------------------------------------------------
// UI ต้องเรนเดอร์ตามผลของฟังก์ชันนี้เท่านั้น ไม่มีข้อมูลก็ไม่ต้องมีกล่องเทา ๆ ว่างเปล่า
// และห้ามเติมค่าปลอมเข้าไปให้ครบช่อง

import type {
  GOGEvent, GOGLineup, GOGStanding, GOGTeamStats, GOGFixture, MatchCapabilities,
} from "@/services/football/types";

/** ช่องสถิติที่นับว่า "มีข้อมูล" ต้องไม่ใช่ null — 0 ถือว่ามีข้อมูล */
function hasAnyStat(stats: GOGTeamStats[]) {
  return stats.some((row) =>
    Object.entries(row).some(([key, value]) => key !== "teamId" && value !== null));
}

export function getMatchCapabilities(input: {
  fixture: GOGFixture;
  events: GOGEvent[];
  lineups: GOGLineup[];
  teamStats: GOGTeamStats[];
  standings: GOGStanding[];
  headToHead: unknown | null;
}): MatchCapabilities {
  return {
    score: input.fixture.homeScore !== null && input.fixture.awayScore !== null,
    events: input.events.length > 0,
    lineups: input.lineups.some((lineup) => lineup.startXI.length > 0),
    teamStats: hasAnyStat(input.teamStats),
    // ยังไม่ดึงสถิติรายผู้เล่นในเวอร์ชันฟรี — เปิดเมื่อ adapter รองรับจริง
    playerStats: false,
    headToHead: Boolean(input.headToHead),
    standings: input.standings.length > 0,
    // สามอย่างนี้ต้องใช้ข้อมูลระดับพิกัด ซึ่งแพ็กฟรีไม่มี ห้ามทำเลียนแบบ (STEP 98, 101)
    xg: false,
    shotCoordinates: false,
    tracking: false,
  };
}

/** ข้อความอธิบายสถานะของแต่ละส่วน ใช้กับสถานะ "ยังไม่มีข้อมูล" (STEP 84) */
export const UNAVAILABLE_REASON_TH: Record<keyof MatchCapabilities, string> = {
  score: "ยังไม่มีสกอร์ — เกมยังไม่เริ่ม",
  events: "ยังไม่มีเหตุการณ์ในเกมนี้",
  lineups: "ยังไม่ประกาศรายชื่อตัวจริง — ปกติออกราว 1 ชั่วโมงก่อนเตะ",
  teamStats: "ผู้ให้บริการยังไม่ส่งสถิติของแมตช์นี้",
  playerStats: "แพ็กข้อมูลปัจจุบันยังไม่รวมสถิติรายผู้เล่น",
  headToHead: "ยังไม่มีสถิติการเจอกันของสองทีมนี้",
  standings: "ยังไม่มีตารางคะแนนของฤดูกาลนี้",
  xg: "ค่าคาดการณ์ประตูต้องใช้ข้อมูลระดับพิกัด ซึ่งยังไม่มีในแพ็กปัจจุบัน",
  shotCoordinates: "ตำแหน่งการยิงต้องใช้ข้อมูลระดับพิกัด ซึ่งยังไม่มีในแพ็กปัจจุบัน",
  tracking: "ข้อมูลตำแหน่งผู้เล่นแบบต่อเนื่องยังไม่มีในแพ็กปัจจุบัน",
};
