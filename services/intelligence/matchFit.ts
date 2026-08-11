// แมตช์ไหนเหมาะกับผม (STEP 73)
// ---------------------------------------------------------------------------
// คนไทยส่วนใหญ่ไม่ได้เลือกนัดจาก "อยากดูนัดไหน" แต่เลือกจาก "ลาได้กี่วัน
// มีเงินเท่าไหร่ ช่วงไหนติดงาน" แล้วค่อยดูว่านัดไหนลงตัว
//
// ไฟล์นี้กลับด้านการค้นหา: กรอกข้อจำกัดของตัวเอง แล้วให้ระบบไล่ทั้ง 380 นัด
// บอกว่านัดไหนไปได้จริง ต้องลากี่วัน ราคาเท่าไหร่ และนัดไหนไปไม่ได้เพราะอะไร
//
// ทุกตัวเลขมาจากฟังก์ชันชุดเดียวกับหน้าวางแผนทริป (recommendTripDates,
// leaveDaysFor, buildMatchTravelPlan) จึงไม่มีทางที่หน้านี้บอกราคาหนึ่ง
// แล้วกดเข้าไปวางแผนจริงได้อีกราคาหนึ่ง

import { leaveDaysFor } from "@/config/thai-holidays";
import { recommendTripDates } from "@/services/football/fixtures";
import { buildMatchTravelPlan } from "@/services/travel/matchToTrip";
import { travelWorthiness } from "@/services/football/travelWorthy";
import type { GOGFixture } from "@/services/football/types";
import type { BudgetStyle, TripLength } from "@/services/trip/types";

export const MATCH_FIT_VERSION = "1.0.0";

export type MatchFitInput = {
  /** วันลาที่ลาได้จริง — ไม่นับเสาร์อาทิตย์และวันหยุดราชการ */
  leaveDaysAvailable: number;
  /** งบต่อคน (บาท) รวมตั๋วเครื่องบิน ที่พัก อาหาร เดินทางในเมือง */
  budgetPerPerson: number;
  budget: BudgetStyle;
  /** ช่วงที่ไปไม่ได้ — [เริ่ม, จบ] แบบ YYYY-MM-DD รวมวันหัวท้าย */
  blackouts: Array<{ from: string; to: string; label?: string }>;
  /** วันแรกที่เดินทางได้ ปกติคือวันนี้ + เวลาทำวีซ่า */
  earliestDeparture: string;
  /** ความยาวทริปที่รับได้ — ว่าง = ลองทุกความยาว */
  lengths?: TripLength[];
};

export type MatchFitVerdict =
  | { fits: true }
  | { fits: false; reason: "blackout" | "too_early" | "leave" | "budget" | "not_plannable"; detail: string };

export type MatchFitResult = {
  fixtureId: string;
  fixture: GOGFixture;
  /** ความยาวทริปที่ดีที่สุดที่ผ่านทุกเงื่อนไข — null เมื่อไม่มีความยาวไหนผ่าน */
  best: {
    length: TripLength;
    departDate: string;
    returnDate: string;
    leaveDays: number;
    weekendDays: number;
    holidayNames: string[];
    pricePerPerson: number;
  } | null;
  verdict: MatchFitVerdict;
  /** คะแนนความน่าไปดูของนัดนี้ (STEP 72) — ใช้เรียงเฉพาะในกลุ่มที่ไปได้ */
  worthScore: number;
  /** เหตุผลภาษาไทยว่าทำไมนัดนี้ลงตัว */
  highlights: string[];
};

const ALL_LENGTHS: TripLength[] = [5, 8, 10];

function overlapsBlackout(from: string, to: string, blackouts: MatchFitInput["blackouts"]) {
  return blackouts.find((window) => {
    if (!window.from || !window.to) return false;
    // สองช่วงทับกันเมื่อ เริ่มของช่วงหนึ่ง <= จบของอีกช่วง ทั้งสองทาง
    return from <= window.to && window.from <= to;
  }) ?? null;
}

/**
 * แผนเดินทางของแต่ละนัดคิดครั้งเดียวแล้วเก็บไว้
 *
 * ไม่ใช่การจูนก่อนเจอปัญหา: rankMatches เรียก evaluateFixture 380 นัด
 * แล้วยังต้องลองใหม่อีก 6 รอบเพื่อตอบว่า "ลาเพิ่มอีกวันจะไปได้อีกกี่นัด"
 * ถ้าไม่เก็บไว้จะกลายเป็นคำนวณตารางราคา 3 ความยาว × 3 งบ ประมาณหมื่นครั้งต่อคำขอ
 */
type PlanCache = Map<string, ReturnType<typeof buildMatchTravelPlan>>;

function planOf(fixture: GOGFixture, cache?: PlanCache) {
  if (!cache) return buildMatchTravelPlan(fixture);
  const hit = cache.get(fixture.id);
  if (hit) return hit;
  const plan = buildMatchTravelPlan(fixture);
  cache.set(fixture.id, plan);
  return plan;
}

function priceFor(plan: ReturnType<typeof buildMatchTravelPlan>, length: TripLength, budget: BudgetStyle) {
  const row = plan.estimates.find((entry) => entry.length === length);
  return row?.prices.find((entry) => entry.budget === budget)?.perPerson ?? null;
}

/**
 * ประเมินนัดเดียว
 *
 * ลำดับการตัดสินสำคัญ: ตัดด้วยเหตุผลที่ผู้ใช้แก้ไม่ได้ก่อน (ไปไม่ได้เลย)
 * แล้วค่อยเหตุผลที่ปรับได้ (ลาไม่พอ งบไม่พอ) เพราะหน้าเว็บจะได้บอกได้ว่า
 * "ถ้าเพิ่มวันลาอีก 1 วันจะไปได้อีก 6 นัด" ซึ่งเป็นข้อมูลที่ใช้ตัดสินใจได้จริง
 */
export function evaluateFixture(fixture: GOGFixture, input: MatchFitInput, cache?: PlanCache): MatchFitResult {
  const lengths = input.lengths?.length ? input.lengths : ALL_LENGTHS;
  const worth = travelWorthiness(fixture);
  const base: Omit<MatchFitResult, "best" | "verdict"> = {
    fixtureId: fixture.id,
    fixture,
    worthScore: worth.score,
    highlights: worth.reasons,
  };

  const matchDate = fixture.kickoffUtc.slice(0, 10);

  // นัดที่เครื่องมือวางแผนทริปยังไม่รองรับ — บอกตรง ๆ ไม่ใช่คิดราคามั่ว
  const plan = planOf(fixture, cache);
  if (!plan.plannable) {
    return { ...base, best: null, verdict: { fits: false, reason: "not_plannable", detail: "ยังไม่มีเส้นทางเดินทางสำหรับนัดนี้ในระบบ" } };
  }

  let best: MatchFitResult["best"] = null;

  /**
   * เหตุผลที่จะตอบผู้ใช้ถ้าไม่มีความยาวทริปไหนผ่านเลย
   *
   * ต้องเก็บของทริปที่ "ใกล้ผ่านที่สุด" ไม่ใช่ของทริปที่ลองเป็นอันสุดท้าย
   * รุ่นแรกเขียนทับไปเรื่อย ๆ เลยขึ้นว่า "ทริป 10 วันต้องลา 6 วัน" ทั้งที่
   * ทริป 5 วันตกด้วยเหตุผลอื่นซึ่งเป็นสิ่งที่ผู้ใช้ควรรู้จริง ๆ
   * ALL_LENGTHS เรียงจากสั้นไปยาว ทริปสั้นจึงใช้วันลาน้อยและถูกที่สุดเสมอ
   * เก็บอันแรกที่ตกไว้ก็คือใกล้ผ่านที่สุด
   */
  let nearest: MatchFitVerdict | null = null;
  const noteMiss = (verdict: MatchFitVerdict) => { if (!nearest) nearest = verdict; };

  for (const length of [...lengths].sort((a, b) => a - b)) {
    const dates = recommendTripDates(fixture.kickoffUtc, length);

    if (dates.departDate < input.earliestDeparture) {
      noteMiss({ fits: false, reason: "too_early", detail: `ต้องออกเดินทาง ${dates.departDate} ซึ่งเร็วกว่าวันที่พร้อมเดินทาง` });
      continue;
    }

    const clash = overlapsBlackout(dates.departDate, dates.returnDate, input.blackouts);
    if (clash) {
      noteMiss({ fits: false, reason: "blackout", detail: clash.label ? `ทับช่วง${clash.label}` : `ทับช่วง ${clash.from} – ${clash.to}` });
      continue;
    }

    const leave = leaveDaysFor(dates.departDate, dates.returnDate);
    if (!leave) continue;
    if (leave.leaveDays > input.leaveDaysAvailable) {
      noteMiss({ fits: false, reason: "leave", detail: `ทริป ${length} วันต้องลา ${leave.leaveDays} วัน มีอยู่ ${input.leaveDaysAvailable} วัน` });
      continue;
    }

    const price = priceFor(plan, length, input.budget);
    if (price === null) continue;
    if (price > input.budgetPerPerson) {
      noteMiss({ fits: false, reason: "budget", detail: `ทริป ${length} วันประมาณ ${price.toLocaleString("th-TH")} บาท เกินงบ` });
      continue;
    }

    const candidate = {
      length,
      departDate: dates.departDate,
      returnDate: dates.returnDate,
      leaveDays: leave.leaveDays,
      weekendDays: leave.weekendDays,
      holidayNames: leave.holidays.map((holiday) => holiday.name),
      pricePerPerson: price,
    };
    // ลาน้อยกว่าชนะเสมอ เท่ากันแล้วเอาทริปที่ยาวกว่า (ได้เที่ยวมากกว่าในราคาที่ยังอยู่ในงบ)
    if (!best || candidate.leaveDays < best.leaveDays
      || (candidate.leaveDays === best.leaveDays && candidate.length > best.length)) {
      best = candidate;
    }
  }

  if (!best) return { ...base, best: null, verdict: nearest ?? { fits: false, reason: "not_plannable", detail: "คำนวณวันเดินทางของนัดนี้ไม่ได้" } };

  const highlights = [...base.highlights];
  if (best.holidayNames.length > 0) highlights.unshift(`ตรงวันหยุด${best.holidayNames.join(" และ ")} ไม่ต้องลาวันนั้น`);
  if (best.leaveDays <= 3) highlights.unshift(`ลางานแค่ ${best.leaveDays} วัน`);
  if (matchDate === best.departDate) highlights.push("แข่งวันเดียวกับวันบิน — ต้องเลื่อนวันเดินทาง");

  return { ...base, best, verdict: { fits: true }, highlights };
}

export type MatchFitReport = {
  version: string;
  fits: MatchFitResult[];
  misses: MatchFitResult[];
  /** ถ้าเพิ่มวันลาอีก 1–3 วัน จะเปิดนัดเพิ่มกี่นัด — ตัวเลขที่ใช้ตัดสินใจได้จริง */
  unlockByLeave: Array<{ extraDays: number; extraMatches: number }>;
  /** ถ้าเพิ่มงบ จะเปิดนัดเพิ่มกี่นัด */
  unlockByBudget: Array<{ extraThb: number; extraMatches: number }>;
};

/** จัดอันดับทั้งลีก — เรียงตามความน่าไปดู แล้วค่อยวันลาน้อย แล้วค่อยราคาถูก */
export function rankMatches(fixtures: GOGFixture[], input: MatchFitInput): MatchFitReport {
  const cache: PlanCache = new Map();
  const results = fixtures.map((fixture) => evaluateFixture(fixture, input, cache));
  const fits = results.filter((result) => result.verdict.fits)
    .sort((a, b) =>
      b.worthScore - a.worthScore
      || (a.best!.leaveDays - b.best!.leaveDays)
      || (a.best!.pricePerPerson - b.best!.pricePerPerson));

  // ตกเพราะเหตุผลที่ปรับได้ ขึ้นก่อนตกเพราะไปไม่ได้เลย
  const missOrder: Record<string, number> = { leave: 0, budget: 1, blackout: 2, too_early: 3, not_plannable: 4 };
  const misses = results.filter((result) => !result.verdict.fits)
    .sort((a, b) => {
      const reasonA = a.verdict.fits ? 9 : missOrder[a.verdict.reason];
      const reasonB = b.verdict.fits ? 9 : missOrder[b.verdict.reason];
      return reasonA - reasonB || b.worthScore - a.worthScore;
    });

  const countFits = (patch: Partial<MatchFitInput>) =>
    fixtures.filter((fixture) => evaluateFixture(fixture, { ...input, ...patch }, cache).verdict.fits).length;

  const unlockByLeave = [1, 2, 3].map((extraDays) => ({
    extraDays,
    extraMatches: countFits({ leaveDaysAvailable: input.leaveDaysAvailable + extraDays }) - fits.length,
  })).filter((entry) => entry.extraMatches > 0);

  const unlockByBudget = [10_000, 20_000, 30_000].map((extraThb) => ({
    extraThb,
    extraMatches: countFits({ budgetPerPerson: input.budgetPerPerson + extraThb }) - fits.length,
  })).filter((entry) => entry.extraMatches > 0);

  return { version: MATCH_FIT_VERSION, fits, misses, unlockByLeave, unlockByBudget };
}
