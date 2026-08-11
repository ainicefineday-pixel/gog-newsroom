// ผลนี้แปลว่าอะไรกับตารางคะแนน (STEP 55, 56)
// ---------------------------------------------------------------------------
// คำนวณจากคณิตศาสตร์ตารางคะแนนล้วน ๆ ไม่มีการเดา
//   ชนะได้ 3 แต้ม เสมอได้ 1 แพ้ได้ 0 แล้วเรียงใหม่ตามกติกาพรีเมียร์ลีก
//   (แต้ม → ผลต่างประตู → ประตูได้)
//
// สิ่งที่ห้ามทำเด็ดขาดตาม STEP 56: อ้างโอกาสได้แชมป์ โอกาสติดท็อปโฟร์
// หรือโอกาสตกชั้น เพราะต้องใช้แบบจำลองความน่าจะเป็นซึ่งเรายังไม่มี
// ทุกประโยคในไฟล์นี้ต้องเป็นเลขที่ตรวจย้อนกลับได้

import type { GOGFixture, GOGStanding } from "@/services/football/types";

export type ImpactOutcome = "win" | "draw" | "loss";

export type TeamImpact = {
  teamId: string;
  teamNameTh: string;
  currentPosition: number;
  currentPoints: number;
  /** ผลลัพธ์แต่ละแบบทำให้แต้มและอันดับเป็นเท่าไหร่ */
  scenarios: Array<{
    outcome: ImpactOutcome;
    points: number;
    position: number;
    positionDelta: number;
    /** ทีมที่แซงได้จากผลนี้ — ชื่อไทย */
    overtakes: string[];
  }>;
};

export type LeagueImpact = {
  home: TeamImpact | null;
  away: TeamImpact | null;
  /** ตารางย่อรอบ ๆ สองทีมนี้ สำหรับแสดงบริบท (STEP 55) */
  context: GOGStanding[];
};

const OUTCOME_POINTS: Record<ImpactOutcome, number> = { win: 3, draw: 1, loss: 0 };

/** เรียงตามกติกาพรีเมียร์ลีก: แต้ม → ผลต่างประตู → ประตูได้ */
function sortTable(rows: GOGStanding[]) {
  return [...rows].sort((a, b) =>
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor);
}

function impactFor(
  standings: GOGStanding[],
  teamId: string,
  opponentId: string,
): TeamImpact | null {
  const row = standings.find((entry) => entry.teamId === teamId);
  if (!row) return null;

  const scenarios = (["win", "draw", "loss"] as ImpactOutcome[]).map((outcome) => {
    const gained = OUTCOME_POINTS[outcome];
    // คู่แข่งได้แต้มตรงข้ามกันเสมอในนัดเดียวกัน จึงต้องขยับทั้งคู่พร้อมกัน
    const opponentGained = outcome === "win" ? 0 : outcome === "draw" ? 1 : 3;

    const projected = standings.map((entry) => {
      if (entry.teamId === teamId) return { ...entry, points: entry.points + gained };
      if (entry.teamId === opponentId) return { ...entry, points: entry.points + opponentGained };
      return entry;
    });

    const ordered = sortTable(projected);
    const position = ordered.findIndex((entry) => entry.teamId === teamId) + 1;
    // ทีมที่เคยอยู่เหนือกว่าแล้วตอนนี้อยู่ต่ำกว่า = แซงได้จริง
    const overtakes = standings
      .filter((entry) => entry.position < row.position)
      .filter((entry) => {
        const after = ordered.findIndex((item) => item.teamId === entry.teamId) + 1;
        return after > position;
      })
      .map((entry) => entry.teamNameTh);

    return {
      outcome,
      points: row.points + gained,
      position,
      positionDelta: row.position - position,
      overtakes,
    };
  });

  return {
    teamId,
    teamNameTh: row.teamNameTh,
    currentPosition: row.position,
    currentPoints: row.points,
    scenarios,
  };
}

/**
 * คืน null เมื่อยังไม่มีตารางคะแนน — หน้าเว็บต้องขึ้นสถานะไม่มีข้อมูล
 * ไม่ใช่แสดงตัวเลขที่คำนวณจากตารางว่าง
 */
export function leagueImpact(fixture: GOGFixture, standings: GOGStanding[]): LeagueImpact | null {
  if (standings.length === 0) return null;

  const home = impactFor(standings, fixture.home.id, fixture.away.id);
  const away = impactFor(standings, fixture.away.id, fixture.home.id);
  if (!home && !away) return null;

  // แสดงบริบทรอบ ๆ สองทีม: สองอันดับเหนือและใต้ทีมที่อยู่สูงกว่า/ต่ำกว่า
  const positions = [home?.currentPosition, away?.currentPosition].filter((value): value is number => typeof value === "number");
  const top = Math.max(Math.min(...positions) - 2, 1);
  const bottom = Math.min(Math.max(...positions) + 2, standings.length);
  const context = standings.filter((row) => row.position >= top && row.position <= bottom);

  return { home, away, context };
}

/** ประโยคไทยสำหรับผลที่เกิดขึ้นจริงหลังจบเกม */
export function impactSentence(impact: TeamImpact, outcome: ImpactOutcome) {
  const scenario = impact.scenarios.find((entry) => entry.outcome === outcome);
  if (!scenario) return "";
  const move = scenario.positionDelta > 0
    ? `ขยับขึ้น ${scenario.positionDelta} อันดับ เป็นอันดับ ${scenario.position}`
    : scenario.positionDelta < 0
      ? `ตกลง ${Math.abs(scenario.positionDelta)} อันดับ เป็นอันดับ ${scenario.position}`
      : `อยู่อันดับ ${scenario.position} เท่าเดิม`;
  const overtake = scenario.overtakes.length > 0 ? ` แซง${scenario.overtakes.join(" และ ")}ได้` : "";
  return `${impact.teamNameTh}มี ${scenario.points} คะแนน ${move}${overtake}`;
}
