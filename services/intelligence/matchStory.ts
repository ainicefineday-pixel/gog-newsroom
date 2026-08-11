// GOG MATCH STORY ENGINE — ใช้กติกาเป็นหลัก ไม่ใช่โยนให้ LLM แต่งเอง (STEP 41–44, 116)
// ---------------------------------------------------------------------------
// ขั้นตอน: คำนวณ "หลักฐาน" ที่เป็นตัวเลขก่อน แล้วค่อยแปลงเป็นประโยคไทย
// ทุกประโยคต้องผูกกับตัวแปรที่คำนวณได้จริง และเก็บระดับความมั่นใจไว้ตรวจย้อนหลังได้
//
// สิ่งที่ห้ามทำ: อ้างเรื่องแท็กติกเชิงตำแหน่ง เช่น "บุกทางฮาล์ฟสเปซขวา"
// เพราะแพ็กข้อมูลฟรีไม่มีพิกัดการเล่น (STEP 42)

import type { GOGEvent, GOGFixture, GOGTeamStats } from "@/services/football/types";
import { controlScore } from "@/services/intelligence/controlScore";

export const STORY_ENGINE_VERSION = "1.0.0";

export type InsightConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MatchInsight = {
  type: string;
  text: string;
  /** ตัวแปรที่ใช้สรุปประโยคนี้ — หน้าแอดมินเปิดดูได้ว่าอ้างจากอะไร (STEP 43, 95) */
  evidence: Record<string, number | string>;
  confidence: InsightConfidence;
};

export type MatchStory = {
  /** สรุปสั้น 2–3 ประโยค (STEP 44) */
  short: string;
  /** สรุปเต็มแบบมีหลักฐานประกอบทีละข้อ */
  insights: MatchInsight[];
  version: string;
};

function teamLabel(fixture: GOGFixture, teamId: string) {
  return teamId === fixture.home.id ? fixture.home.shortName : fixture.away.shortName;
}

/**
 * สร้างเรื่องเล่าของแมตช์จากสถิติและเหตุการณ์ที่มีจริง
 * ไม่มีสถิติเลยก็คืน null — หน้าเว็บต้องขึ้นสถานะไม่มีข้อมูล ไม่ใช่เขียนลอย ๆ
 */
export function buildMatchStory(
  fixture: GOGFixture,
  stats: GOGTeamStats[],
  events: GOGEvent[],
): MatchStory | null {
  const home = stats.find((row) => row.teamId === fixture.home.id);
  const away = stats.find((row) => row.teamId === fixture.away.id);
  const insights: MatchInsight[] = [];

  // ── สกอร์: เป็นข้อเท็จจริงตรง ๆ ความมั่นใจสูงสุดเสมอ
  if (fixture.homeScore !== null && fixture.awayScore !== null) {
    const finished = fixture.state === "full_time";
    const leader = fixture.homeScore === fixture.awayScore
      ? null
      : fixture.homeScore > fixture.awayScore ? fixture.home : fixture.away;
    insights.push({
      type: "scoreline",
      text: leader
        ? `${finished ? "จบเกม" : "ขณะนี้"} ${fixture.home.shortName} ${fixture.homeScore}–${fixture.awayScore} ${fixture.away.shortName} โดย${leader.shortName}เป็นฝ่ายนำ`
        : `${finished ? "จบเกม" : "ขณะนี้"}ทั้งสองทีมเสมอกัน ${fixture.homeScore}–${fixture.awayScore}`,
      evidence: { homeScore: fixture.homeScore, awayScore: fixture.awayScore },
      confidence: "HIGH",
    });
  }

  // ── การครองบอล: ต่างกันเกิน 10% ถึงจะพูดถึง ไม่งั้นถือว่าพอ ๆ กัน
  if (home?.possession !== null && home?.possession !== undefined && away?.possession !== null && away?.possession !== undefined) {
    const difference = Math.abs(home.possession - away.possession);
    const leader = home.possession >= away.possession ? fixture.home : fixture.away;
    insights.push({
      type: "possession",
      text: difference < 10
        ? `การครองบอลใกล้เคียงกันมาก ${home.possession}% ต่อ ${away.possession}%`
        : `${leader.shortName}ครองบอลเหนือกว่าชัดเจนที่ ${Math.max(home.possession, away.possession)}%`,
      evidence: { homePossession: home.possession, awayPossession: away.possession, difference },
      confidence: difference < 10 ? "MEDIUM" : "HIGH",
    });
  }

  // ── โอกาสยิง: ดูทั้งจำนวนครั้งและที่เข้ากรอบ เพราะยิงเยอะแต่ไม่เข้ากรอบไม่ได้แปลว่าเหนือกว่า
  if (typeof home?.shots === "number" && typeof away?.shots === "number") {
    const leader = home.shots >= away.shots ? fixture.home : fixture.away;
    const ratio = Math.min(home.shots, away.shots) === 0
      ? null
      : Math.round((Math.max(home.shots, away.shots) / Math.min(home.shots, away.shots)) * 10) / 10;
    insights.push({
      type: "shots",
      text: `${leader.shortName}มีโอกาสยิงมากกว่า ${Math.max(home.shots, away.shots)} ครั้ง เทียบกับ ${Math.min(home.shots, away.shots)} ครั้ง`,
      evidence: { homeShots: home.shots, awayShots: away.shots, ...(ratio ? { ratio } : {}) },
      confidence: Math.abs(home.shots - away.shots) >= 4 ? "HIGH" : "MEDIUM",
    });
  }

  if (typeof home?.shotsOnTarget === "number" && typeof away?.shotsOnTarget === "number") {
    const leader = home.shotsOnTarget >= away.shotsOnTarget ? fixture.home : fixture.away;
    insights.push({
      type: "shots_on_target",
      text: `ยิงเข้ากรอบ ${fixture.home.shortName} ${home.shotsOnTarget} ครั้ง ${fixture.away.shortName} ${away.shotsOnTarget} ครั้ง — ${leader.shortName}สร้างโอกาสอันตรายได้มากกว่า`,
      evidence: { homeOnTarget: home.shotsOnTarget, awayOnTarget: away.shotsOnTarget },
      confidence: "HIGH",
    });
  }

  // ── ใบแดง: เป็นเหตุการณ์ที่เปลี่ยนเกมจริง พูดได้โดยไม่ต้องมีข้อมูลตำแหน่ง
  const redCards = events.filter((event) => event.type === "red_card" || event.type === "second_yellow");
  for (const card of redCards) {
    insights.push({
      type: "red_card",
      text: `${teamLabel(fixture, card.teamId)}เหลือผู้เล่น 10 คนตั้งแต่นาทีที่ ${card.minute}`,
      evidence: { minute: card.minute, team: teamLabel(fixture, card.teamId) },
      confidence: "HIGH",
    });
  }

  // ── ดัชนีคุมเกมของ GOG ปิดท้าย เพราะเป็นค่าที่สังเคราะห์ ไม่ใช่ข้อเท็จจริงดิบ
  const control = controlScore(home, away);
  if (control) {
    const leader = control.homeScore >= control.awayScore ? fixture.home : fixture.away;
    insights.push({
      type: "control",
      text: `ดัชนีคุมเกมของ GOG ให้${leader.shortName}นำที่ ${Math.max(control.homeScore, control.awayScore)} ต่อ ${Math.min(control.homeScore, control.awayScore)}`,
      evidence: { homeControl: control.homeScore, awayControl: control.awayScore, inputs: control.inputs.length },
      confidence: control.inputs.length >= 4 ? "HIGH" : "MEDIUM",
    });
  }

  if (insights.length === 0) return null;

  return {
    short: insights.slice(0, 3).map((insight) => insight.text).join(" · "),
    insights,
    version: STORY_ENGINE_VERSION,
  };
}
