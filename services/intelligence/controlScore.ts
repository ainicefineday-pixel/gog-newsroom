// GOG CONTROL SCORE LITE (STEP 39, 40, 116)
// ---------------------------------------------------------------------------
// ดัชนีของ GOG เอง ไม่ใช่เรตติ้งของเจ้าอื่น — ประเมิน "ภาพรวมใครคุมเกม" จากสถิติพื้นฐาน
// ที่ผู้ให้บริการส่งมาจริงเท่านั้น
//
// กติกาที่ห้ามพลาด:
//   - ช่องไหนเป็น null ต้องตัดออกจากการคิด แล้วเกลี่ยน้ำหนักที่เหลือใหม่ (STEP 39)
//     ไม่ใช่คิดเป็น 0 เพราะ "ไม่มีข้อมูล" กับ "ทำได้ศูนย์" คนละเรื่อง (STEP 115)
//   - ต้องเปิดเผยว่าคิดจากอะไรได้เสมอ (STEP 40)

import type { GOGTeamStats } from "@/services/football/types";

export const CONTROL_SCORE_VERSION = "1.0.0";

type Metric = { key: keyof GOGTeamStats; label: string; weight: number };

/** น้ำหนักตั้งต้น — รวมกัน 100 เมื่อมีข้อมูลครบ */
const METRICS: Metric[] = [
  { key: "possession", label: "การครองบอล", weight: 20 },
  { key: "shots", label: "ยิงทั้งหมด", weight: 20 },
  { key: "shotsOnTarget", label: "ยิงเข้ากรอบ", weight: 30 },
  { key: "corners", label: "เตะมุม", weight: 10 },
  { key: "passAccuracy", label: "ความแม่นยำการจ่ายบอล", weight: 10 },
  { key: "passes", label: "จำนวนการจ่ายบอล", weight: 10 },
];

export type ControlScoreInput = { label: string; value: number; opponentValue: number; weight: number };

export type ControlScoreResult = {
  homeScore: number;
  awayScore: number;
  /** ตัวชี้วัดที่ใช้จริงพร้อมน้ำหนักหลังเกลี่ยแล้ว — เอาไปแสดงตอนกด "คำนวณอย่างไร?" */
  inputs: ControlScoreInput[];
  /** ตัวชี้วัดที่ตัดออกเพราะไม่มีข้อมูล */
  skipped: string[];
  version: string;
};

/**
 * คิดคะแนนคุมเกมของสองทีม รวมกันได้ 100
 * แต่ละตัวชี้วัด normalize เป็นส่วนแบ่งของผลรวมสองทีมก่อน แล้วค่อยถ่วงน้ำหนัก
 * คืน null เมื่อไม่เหลือตัวชี้วัดที่ใช้ได้เลย — ต้องขึ้นสถานะไม่มีข้อมูล ไม่ใช่โชว์ 50/50
 */
export function controlScore(home: GOGTeamStats | undefined, away: GOGTeamStats | undefined): ControlScoreResult | null {
  if (!home || !away) return null;

  const usable: Array<Metric & { homeValue: number; awayValue: number }> = [];
  const skipped: string[] = [];

  for (const metric of METRICS) {
    const homeValue = home[metric.key];
    const awayValue = away[metric.key];
    if (typeof homeValue !== "number" || typeof awayValue !== "number") {
      skipped.push(metric.label);
      continue;
    }
    // ทั้งคู่เป็นศูนย์แปลว่าไม่มีอะไรให้เทียบ เช่นเตะมุม 0-0 ตอนต้นเกม
    if (homeValue + awayValue === 0) {
      skipped.push(metric.label);
      continue;
    }
    usable.push({ ...metric, homeValue, awayValue });
  }

  if (usable.length === 0) return null;

  // เกลี่ยน้ำหนักที่เหลือให้รวมเป็น 100 เสมอ ไม่ว่าจะเหลือกี่ตัว
  const weightTotal = usable.reduce((sum, metric) => sum + metric.weight, 0);
  let homeScore = 0;
  const inputs: ControlScoreInput[] = [];

  for (const metric of usable) {
    const share = metric.homeValue / (metric.homeValue + metric.awayValue);
    const weight = (metric.weight / weightTotal) * 100;
    homeScore += share * weight;
    inputs.push({
      label: metric.label,
      value: metric.homeValue,
      opponentValue: metric.awayValue,
      weight: Math.round(weight * 10) / 10,
    });
  }

  const rounded = Math.round(homeScore);
  return {
    homeScore: rounded,
    awayScore: 100 - rounded,
    inputs,
    skipped,
    version: CONTROL_SCORE_VERSION,
  };
}
