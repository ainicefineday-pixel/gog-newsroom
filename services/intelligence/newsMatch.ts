// เชื่อมข่าวกับแมตช์ (STEP 71)
// ---------------------------------------------------------------------------
// ข่าวกับโปรแกรมแข่งอยู่คนละระบบมาตลอด อ่านข่าว "ยูไนเต็ดเตรียมรับมืออาร์เซนอล"
// แล้วต้องไปเปิดปฏิทินหาเองว่านัดไหน วันไหน บินไปดูคุ้มไหม
//
// ไฟล์นี้จับคู่ด้วยพจนานุกรมชื่อทีมชุดเดียวกับที่ใช้ normalize ข้อมูลผู้ให้บริการ
// จึงไม่ต้องมีรายชื่อทีมชุดที่สองให้หลุดกัน และไม่ใช้ LLM เดา
//
// หลักการที่ยอมพลาดดีกว่าเดาผิด:
//   เจอทีมเดียว (แมนยู) = ข่าวสโมสร ไม่ผูกกับนัดไหน
//   เจอสองทีมขึ้นไปที่ไม่ได้เจอกันในโปรแกรม = ไม่ผูก
//   ผูกได้ต้องมีนัดจริงในโปรแกรมเท่านั้น ไม่มีการสร้างนัดขึ้นมาเอง

import { TEAM_NAMES, normalizeName, resolveOfficialName } from "@/services/football/thai";
import type { GOGFixture } from "@/services/football/types";

export type NewsMatchLink = {
  storyId: string;
  fixtureId: string;
  /** ทีมที่เจอในข่าว — ชื่อทางการ */
  teams: string[];
  /** ย่อของนัด เพื่อให้การ์ดข่าวแสดงป้ายได้โดยไม่ต้องยิงขอโปรแกรมซ้ำ */
  fixture: { homeTh: string; awayTh: string; kickoffUtc: string; kickoffTimeAnnounced: boolean };
  /**
   * สูง = ชื่อคู่แข่งอยู่ในพาดหัว กลาง = อยู่แต่ในเนื้อข่าว
   * ไม่มี "แน่นอน" เพราะข่าวไม่เคยระบุ fixture id
   */
  confidence: "high" | "medium";
  /** ข่าวออกก่อนแข่งกี่วัน — ติดลบคือข่าวหลังจบเกม */
  daysBeforeKickoff: number;
};

export type StoryLike = {
  id: string;
  titleEn: string;
  titleTh: string;
  excerptEn: string;
  summaryTh: string;
  topicTerms: string[];
  publishedAt: string;
};

/**
 * วลีที่ใช้ค้นในเนื้อข่าว — normalize แบบเดียวกับตอนจับคู่ชื่อทีม
 * ตัดตัวย่อสามตัวอักษร (ARS, LIV, MUN) ออกทั้งหมด เพราะเป็นรหัสของผู้ให้บริการ
 * ไม่ใช่คำที่นักข่าวเขียน แต่ไปชนคำอังกฤษธรรมดาได้ง่าย เช่น SUN ในวันอาทิตย์
 */
const TEAM_PHRASES: Array<{ official: string; phrase: string }> = [];
for (const [official, record] of Object.entries(TEAM_NAMES)) {
  const phrases = [official, record.th, record.short, ...record.aliases]
    .filter((value) => !/^[A-Z]{3}$/.test(value));
  for (const phrase of new Set(phrases.map(normalizeName))) {
    TEAM_PHRASES.push({ official, phrase });
  }
}
// วลียาวก่อน เพื่อให้ "manchester united" ชนะ "manchester" ถ้าวันหนึ่งมีวลีสั้นแบบนั้น
TEAM_PHRASES.sort((a, b) => b.phrase.length - a.phrase.length);

/** ขอบเขตคำสำหรับข้อความที่ normalize แล้ว — ภาษาไทยไม่เว้นวรรค จึงเช็กเฉพาะละติน */
function containsPhrase(haystack: string, phrase: string) {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(phrase, from);
    if (at < 0) return false;
    const before = haystack[at - 1];
    const after = haystack[at + phrase.length];
    const latinBefore = before !== undefined && /[a-z0-9]/.test(before);
    const latinAfter = after !== undefined && /[a-z0-9]/.test(after);
    if (!latinBefore && !latinAfter) return true;
    from = at + 1;
  }
}

/** ทีมทั้งหมดที่ปรากฏในข้อความ — ชื่อทางการ ไม่ซ้ำ */
export function detectTeams(text: string): string[] {
  if (!text) return [];
  const haystack = normalizeName(text);
  const found = new Set<string>();
  for (const entry of TEAM_PHRASES) {
    if (found.has(entry.official)) continue;
    if (containsPhrase(haystack, entry.phrase)) found.add(entry.official);
  }
  return [...found];
}

/** คู่ชื่อทางการของนัดหนึ่ง — null เมื่อมีทีมที่ยังไม่มีในพจนานุกรม จับคู่ข่าวไม่ได้ */
function fixturePair(fixture: GOGFixture): [string, string] | null {
  const home = resolveOfficialName(fixture.home.name);
  const away = resolveOfficialName(fixture.away.name);
  return home && away ? [home, away] : null;
}

/**
 * คำที่บอกว่าข่าวกำลังพูดถึง "เกมที่สองทีมเจอกัน" ไม่ใช่แค่เอ่ยชื่อสโมสร
 *
 * จำเป็นมาก เพราะข่าวตลาดซื้อขายเอ่ยชื่อทีมรัว ๆ เป็นเรื่องปกติ
 * ทดสอบกับฟีดจริง 64 ข่าว (11 ส.ค. 2026) เจอข่าวหนึ่งเขียนว่า
 * "Bournemouth took points off Arsenal, Manchester City, Manchester United,
 *  Liverpool and Chelsea" ซึ่งถ้าดูแต่ชื่อทีมจะไปผูกกับนัดแมนซิตี้-บอร์นมัธ
 * ทั้งที่เป็นข่าวย้ายทีมของนักเตะคนหนึ่ง
 *
 * ต้องเจอในพาดหัวเท่านั้น เพราะพาดหัวคือสิ่งที่บอกว่าข่าวชิ้นนี้เรื่องอะไร
 * ส่วนเนื้อข่าวพูดถึงอะไรก็ได้
 */
const VERSUS_CUE = /\bvs?\b|\bagainst\b|\bfaces?\b|\bfacing\b|\bhosts?\b|\bmeets?\b|\btravel to\b|\baway (?:at|to)\b|\bat home to\b|\bclash\b|\bpreview\b|\bteam news\b|\bplayer ratings\b|\bmatch report\b|พบ|บุก|เปิดบ้าน|ดวล|ปะทะ/i;

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS);
}

/**
 * เลือกนัดที่ข่าวน่าจะพูดถึงที่สุด
 *
 * ทีมสองทีมเจอกันปีละสองนัด (เหย้า-เยือน) ข่าวไม่เคยบอกว่านัดไหน
 * จึงใช้วันเผยแพร่เป็นตัวตัดสิน โดยให้น้ำหนักนัดที่ยังไม่เตะมากกว่า
 * เพราะข่าวส่วนใหญ่เขียนก่อนเกม — แต่ข่าวหลังเกม (รายงานผล บทวิเคราะห์)
 * ก็ต้องจับได้ จึงเปิดหน้าต่างย้อนหลังไว้ด้วยแต่แคบกว่า
 */
const WINDOW_BEFORE_DAYS = 21;
const WINDOW_AFTER_DAYS = 5;

function pickFixture(candidates: GOGFixture[], publishedAt: string) {
  let best: { fixture: GOGFixture; days: number } | null = null;
  for (const fixture of candidates) {
    const days = daysBetween(publishedAt, fixture.kickoffUtc);
    if (days > WINDOW_BEFORE_DAYS || days < -WINDOW_AFTER_DAYS) continue;
    // ข่าวก่อนเกมชนะข่าวหลังเกมเสมอเมื่อระยะห่างเท่ากัน
    const rank = days >= 0 ? days : Math.abs(days) + 0.5;
    const bestRank = best ? (best.days >= 0 ? best.days : Math.abs(best.days) + 0.5) : Infinity;
    if (rank < bestRank) best = { fixture, days };
  }
  return best;
}

/**
 * จับคู่ข่าวหนึ่งชิ้นกับนัดในโปรแกรม — คืน null เมื่อผูกไม่ได้อย่างมั่นใจ
 * null ไม่ใช่ความล้มเหลว แต่คือคำตอบว่า "ข่าวนี้ไม่ได้พูดถึงนัดใดนัดหนึ่ง"
 */
export function linkStory(story: StoryLike, fixtures: GOGFixture[]): NewsMatchLink | null {
  const headline = `${story.titleEn} ${story.titleTh}`;
  const body = `${story.excerptEn} ${story.summaryTh} ${story.topicTerms.join(" ")}`;

  // พาดหัวต้องบอกว่าเป็นเกมที่เจอกัน ไม่งั้นข่าวตลาดซื้อขายจะถูกผูกมั่ว
  if (!VERSUS_CUE.test(headline)) return null;

  const headlineTeams = detectTeams(headline);
  // อย่างน้อยหนึ่งทีมต้องอยู่ในพาดหัว — เอ่ยชื่อลึกในเนื้อข่าวอย่างเดียวไม่พอ
  if (headlineTeams.length === 0) return null;

  const allTeams = [...new Set([...headlineTeams, ...detectTeams(body)])];
  if (allTeams.length < 2) return null;
  // เอ่ยถึงห้าทีมขึ้นไป = ข่าวรวมหรือบทวิเคราะห์ฤดูกาล ไม่ใช่ข่าวของนัดใดนัดหนึ่ง
  if (allTeams.length > 4) return null;

  // ต้องมีนัดที่สองทีมนี้เจอกันจริงในโปรแกรมเท่านั้น
  // ชื่อจากผู้ให้บริการต้องผ่านพจนานุกรมก่อน เพราะมาเป็น "Arsenal FC" บ้าง "Arsenal" บ้าง
  const candidates = fixtures.filter((fixture) => {
    const pair = fixturePair(fixture);
    return pair !== null && allTeams.includes(pair[0]) && allTeams.includes(pair[1]);
  });
  if (candidates.length === 0) return null;

  const picked = pickFixture(candidates, story.publishedAt);
  if (!picked) return null;

  const pair = fixturePair(picked.fixture);
  if (!pair) return null;
  // พาดหัวเอ่ยถึงทั้งคู่ = มั่นใจกว่าเจอชื่อคู่แข่งลึกในเนื้อข่าว
  const confidence = pair.every((team) => headlineTeams.includes(team)) ? "high" : "medium";

  return {
    storyId: story.id,
    fixtureId: picked.fixture.id,
    teams: pair,
    fixture: {
      homeTh: picked.fixture.home.nameTh,
      awayTh: picked.fixture.away.nameTh,
      kickoffUtc: picked.fixture.kickoffUtc,
      kickoffTimeAnnounced: picked.fixture.kickoffTimeAnnounced,
    },
    confidence,
    daysBeforeKickoff: picked.days,
  };
}

/** จับคู่ทั้งฟีด — ใช้ทั้งฝั่งข่าว (ข่าวนี้เกี่ยวกับนัดไหน) และฝั่งแมตช์ (นัดนี้มีข่าวอะไร) */
export function linkStories(stories: StoryLike[], fixtures: GOGFixture[]): NewsMatchLink[] {
  return stories
    .map((story) => linkStory(story, fixtures))
    .filter((link): link is NewsMatchLink => link !== null);
}

/** ข่าวของนัดหนึ่ง เรียงจากใกล้วันแข่งที่สุด */
export function storiesForFixture(links: NewsMatchLink[], fixtureId: string) {
  return links
    .filter((link) => link.fixtureId === fixtureId)
    .sort((a, b) => Math.abs(a.daysBeforeKickoff) - Math.abs(b.daysBeforeKickoff));
}

/** ประโยคไทยบอกว่าข่าวชิ้นนี้อยู่ตรงไหนของไทม์ไลน์แมตช์ */
export function linkTimingTh(link: NewsMatchLink) {
  if (link.daysBeforeKickoff > 1) return `ก่อนแข่ง ${link.daysBeforeKickoff} วัน`;
  if (link.daysBeforeKickoff === 1) return "ก่อนแข่ง 1 วัน";
  if (link.daysBeforeKickoff === 0) return "วันแข่ง";
  return `หลังแข่ง ${Math.abs(link.daysBeforeKickoff)} วัน`;
}
