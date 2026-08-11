// รายงานผลบอลภาษาไทยอัตโนมัติเมื่อจบเกม (STEP 45, 46)
// ---------------------------------------------------------------------------
// พอนกหวีดจบเกม แฟนบอลไทยอยากอ่านสรุปเป็นภาษาไทยทันที ไม่ใช่รอสำนักข่าวอังกฤษ
// เขียนแล้วรอคนแปลอีกหลายชั่วโมง ไฟล์นี้ประกอบข่าวจากสิ่งที่เกิดขึ้นจริงในสนาม
//
// กติกาที่ห้ามละเมิดเด็ดขาด:
//   ทุกประโยคต้องมาจากตัวเลขหรือเหตุการณ์ที่ผู้ให้บริการยืนยันแล้ว
//   ไม่มีการเดาความรู้สึกนักเตะ ไม่มีการวิจารณ์ผู้ตัดสิน ไม่มีคำพูดที่ไม่มีใครพูด
//   ไม่มีสถิติที่ไม่ได้มาจาก bundle — เพราะข่าวที่ผิดแต่อ่านลื่นอันตรายกว่าไม่มีข่าว
//
// ถ้าข้อมูลไม่พอจะเขียนข่าวที่มีเนื้อหา ให้คืน null แล้วไม่ต้องเผยแพร่
// ดีกว่าปล่อยข่าวที่มีแต่สกอร์ลอย ๆ ออกไปในฟีดที่คนคาดหวังเนื้อข่าวจริง

import { thaiFullDate } from "@/services/football/normalize";
import { EVENT_LABELS_TH } from "@/services/football/thai";
import { buildMatchStory } from "@/services/intelligence/matchStory";
import { buildKeyMoments } from "@/services/intelligence/keyMoments";
import { impactSentence, leagueImpact, type ImpactOutcome } from "@/services/intelligence/leagueImpact";
import type { GOGEvent, GOGFixture, GOGStanding, GOGTeamStats } from "@/services/football/types";

export const MATCH_REPORT_VERSION = "1.0.0";

export type MatchReport = {
  /** id ของข่าวในคลัง — คงที่ต่อหนึ่งนัด เขียนทับได้ถ้าข้อมูลมาเพิ่มทีหลัง */
  storyId: string;
  fixtureId: string;
  titleTh: string;
  titleEn: string;
  summaryTh: string;
  contentTh: string;
  publishedAt: string;
  version: string;
};

function scoreLine(fixture: GOGFixture) {
  return `${fixture.home.nameTh} ${fixture.homeScore}-${fixture.awayScore} ${fixture.away.nameTh}`;
}

/** ผลของทีมหนึ่งจากสกอร์ — ใช้ต่อกับ leagueImpact เพื่อบอกว่าขยับอันดับยังไง */
function outcomeFor(fixture: GOGFixture, side: "home" | "away"): ImpactOutcome | null {
  if (fixture.homeScore === null || fixture.awayScore === null) return null;
  if (fixture.homeScore === fixture.awayScore) return "draw";
  const homeWon = fixture.homeScore > fixture.awayScore;
  return (side === "home") === homeWon ? "win" : "loss";
}

/** พาดหัวไทย — บอกผลตรง ๆ ไม่ใช้คำเร้าอารมณ์ที่ไม่มีข้อมูลรองรับ */
function headline(fixture: GOGFixture) {
  const home = fixture.home.nameTh;
  const away = fixture.away.nameTh;
  if (fixture.homeScore === fixture.awayScore) {
    return `${home} เสมอ ${away} ${fixture.homeScore}-${fixture.awayScore}`;
  }
  const homeWon = (fixture.homeScore ?? 0) > (fixture.awayScore ?? 0);
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const big = Math.abs((fixture.homeScore ?? 0) - (fixture.awayScore ?? 0)) >= 3;
  const goalsFor = Math.max(fixture.homeScore ?? 0, fixture.awayScore ?? 0);
  const goalsAgainst = Math.min(fixture.homeScore ?? 0, fixture.awayScore ?? 0);
  // "ถล่ม" ใช้ได้เมื่อชนะขาดสามลูกขึ้นไปเท่านั้น เป็นเกณฑ์ตัวเลข ไม่ใช่ความรู้สึก
  return `${winner} ${big ? "ถล่ม" : "ชนะ"} ${loser} ${goalsFor}-${goalsAgainst}`;
}

/** ลำดับประตูตามนาที — เนื้อข่าวที่แฟนบอลอยากอ่านที่สุดคือใครยิงนาทีไหน */
function goalNarrative(fixture: GOGFixture, events: GOGEvent[]) {
  const goals = events
    .filter((event) => event.type === "goal" || event.type === "own_goal" || event.type === "penalty")
    .sort((a, b) => a.minute - b.minute);
  if (goals.length === 0) return "";

  const lines = goals.map((goal) => {
    const team = goal.teamId === fixture.home.id ? fixture.home.shortName : fixture.away.shortName;
    const kind = goal.type === "own_goal" ? " (ทำเข้าประตูตัวเอง)" : goal.type === "penalty" ? " (จุดโทษ)" : "";
    return `นาทีที่ ${goal.minute}${goal.playerName ? ` — ${goal.playerName}` : ""} ทำประตูให้${team}${kind}`;
  });
  return lines.join("\n");
}

/** ใบเหลืองใบแดง — บอกเฉพาะใบแดง เพราะใบเหลืองรายบุคคลไม่ใช่สาระของข่าวสรุป */
function disciplineLine(fixture: GOGFixture, events: GOGEvent[]) {
  const reds = events.filter((event) => event.type === "red_card" || event.type === "second_yellow");
  if (reds.length === 0) return "";
  return reds.map((event) => {
    const team = event.teamId === fixture.home.id ? fixture.home.shortName : fixture.away.shortName;
    const label = EVENT_LABELS_TH[event.type] ?? "ใบแดง";
    // ชื่อนักเตะเป็นอักษรละติน ต้องเว้นวรรคทั้งหน้าและหลัง ไม่งั้นติดกับคำไทยจนอ่านยาก
    return event.playerName
      ? `${team}เหลือผู้เล่น 10 คนตั้งแต่นาทีที่ ${event.minute} หลัง ${event.playerName} โดน${label}`
      : `${team}เหลือผู้เล่น 10 คนตั้งแต่นาทีที่ ${event.minute} จาก${label}`;
  }).join(" ");
}

/**
 * ประกอบรายงานฉบับเต็ม
 *
 * คืน null เมื่อ:
 *   - เกมยังไม่จบ (ไม่รายงานผลเกมที่ยังเตะอยู่)
 *   - ไม่มีสกอร์ (ไม่มีอะไรให้รายงาน)
 *   - มีแต่สกอร์ ไม่มีทั้งเหตุการณ์และสถิติ (เขียนได้แค่บรรทัดเดียว ไม่คุ้มที่จะเป็นข่าว)
 */
export function buildMatchReport(
  fixture: GOGFixture,
  stats: GOGTeamStats[],
  events: GOGEvent[],
  standings: GOGStanding[],
  now = new Date().toISOString(),
): MatchReport | null {
  if (fixture.state !== "full_time") return null;
  if (fixture.homeScore === null || fixture.awayScore === null) return null;

  const story = buildMatchStory(fixture, stats, events);
  const moments = buildKeyMoments(fixture, events);
  const goals = goalNarrative(fixture, events);
  const hasSubstance = goals.length > 0 || moments.length > 0 || stats.length > 0;
  if (!hasSubstance) return null;

  const paragraphs: string[] = [];

  paragraphs.push(
    // ชื่อสนามเป็นอักษรละติน ต้องเว้นวรรคหลัง "ที่" ไม่งั้นได้ "จบลงแล้วที่Old Trafford"
    `${scoreLine(fixture)} จบลงแล้ว${fixture.venue?.name ? `ที่ ${fixture.venue.name}` : ""}`
    + `${fixture.matchweek ? ` ในนัดที่ ${fixture.matchweek} ของ${fixture.competitionName}` : ""}`
    + ` เมื่อ${thaiFullDate(fixture.kickoffUtc)}`,
  );

  if (goals) paragraphs.push(`ลำดับการทำประตู\n${goals}`);

  const discipline = disciplineLine(fixture, events);
  if (discipline) paragraphs.push(discipline);

  // สถิติเชิงตัวเลข — มาจากเครื่องมือเดียวกับที่หน้าแมตช์ใช้
  //   scoreline ตัดออกเพราะย่อหน้าแรกบอกสกอร์ไปแล้ว
  //   red_card ตัดออกเพราะย่อหน้าใบแดงข้างบนบอกละเอียดกว่า (มีชื่อนักเตะ)
  // ถ้าไม่ตัด ข่าวสั้น ๆ ชิ้นเดียวจะพูดเรื่องเดิมสามรอบ
  if (story) {
    const numeric = story.insights.filter((insight) => insight.type !== "scoreline" && insight.type !== "red_card");
    if (numeric.length > 0) {
      paragraphs.push(`สถิติที่บอกอะไรได้บ้าง\n${numeric.map((insight) => `• ${insight.text}`).join("\n")}`);
    }
  }

  // ผลกับตารางคะแนน — คำนวณล้วน ไม่ใช่การคาดการณ์
  const impact = leagueImpact(fixture, standings);
  const homeOutcome = outcomeFor(fixture, "home");
  const awayOutcome = outcomeFor(fixture, "away");
  const tableLines = [
    impact?.home && homeOutcome ? impactSentence(impact.home, homeOutcome) : "",
    impact?.away && awayOutcome ? impactSentence(impact.away, awayOutcome) : "",
  ].filter(Boolean);
  if (tableLines.length > 0) paragraphs.push(`ผลกับตารางคะแนน\n${tableLines.map((line) => `• ${line}`).join("\n")}`);

  paragraphs.push(
    "รายงานนี้เขียนโดยระบบ GOG จากสถิติและเหตุการณ์ที่ผู้ให้บริการข้อมูลยืนยันแล้ว "
    + "ไม่มีการเพิ่มความเห็นหรือคำพูดที่ไม่มีแหล่งอ้างอิง",
  );

  const summary = story?.short
    ?? `${scoreLine(fixture)} — สรุปผลและสถิติของเกมนี้`;

  return {
    storyId: `gog-match-${fixture.id}`,
    fixtureId: fixture.id,
    titleTh: headline(fixture),
    titleEn: `${fixture.home.name} ${fixture.homeScore}-${fixture.awayScore} ${fixture.away.name}`,
    summaryTh: summary,
    contentTh: paragraphs.join("\n\n"),
    publishedAt: now,
    version: MATCH_REPORT_VERSION,
  };
}
