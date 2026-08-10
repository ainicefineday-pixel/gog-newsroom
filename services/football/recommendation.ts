// จัดระดับความน่าไปของแต่ละแมตช์ + ป้ายแนะนำ
// ---------------------------------------------------------------------------
// ตอบคำถามที่แฟนบอลถามจริง ๆ ว่า "ถ้าจะบินไปดูสักนัด ควรไปนัดไหน"
// เกณฑ์ทั้งหมดอยู่ในไฟล์นี้ที่เดียว ปรับได้โดยไม่ต้องแตะ UI

import type { PlannableFixture } from "@/services/football/fixtures";

export type FixtureTier = "must" | "should" | "optional";

export type FixtureBadge = {
  label: string;
  kind: "must" | "should" | "value" | "weekend" | "derby" | "bigmatch";
};

/**
 * ชื่อเรียกประจำคู่ — ป้ายบนการ์ดแมตช์ในหน้าวางแผนทริปและตารางโปรแกรม
 * ทุกคู่ในตารางนี้นับเป็นคู่ปรับ (rival) โดยอัตโนมัติ ไม่ต้องมีลิสต์แยกอีกชุด
 */
const RIVALRY: Record<string, FixtureBadge> = {
  "Manchester City": { label: "แมนเชสเตอร์ ดาร์บี้", kind: "derby" },
  "Liverpool": { label: "แดงเดือด", kind: "derby" },
  "Leeds United": { label: "War of the Roses", kind: "derby" },
  "Chelsea": { label: "Big Match", kind: "bigmatch" },
  "Arsenal": { label: "Big Match", kind: "bigmatch" },
  "Tottenham Hotspur": { label: "Big Match", kind: "bigmatch" },
};

export type FixtureRecommendation = {
  tier: FixtureTier;
  tierLabel: string;
  /** เหตุผลสั้น ๆ ว่าทำไมถึงจัดอยู่ระดับนี้ */
  reason: string;
  badges: FixtureBadge[];
  /** true = การ์ดขึ้นสีทอง (แมตช์พิเศษ) */
  special: boolean;
};

function isWeekend(kickoffUtc: string) {
  // ใช้เวลาอังกฤษเป็นเกณฑ์ เพราะวันแข่งจริงอิงเวลาท้องถิ่นของสนาม
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
    .format(new Date(kickoffUtc));
  return day === "Sat" || day === "Sun";
}

/**
 * cheapestKey = key ของแมตช์ที่ทริปถูกที่สุด (คำนวณจาก services/pricing ฝั่งเรียก)
 * ส่งเข้ามาเพื่อไม่ให้ไฟล์นี้ต้องรู้เรื่องราคา
 */
export function recommendFixture(fixture: PlannableFixture, cheapestKey?: string): FixtureRecommendation {
  const badges: FixtureBadge[] = [];
  const rivalry = RIVALRY[fixture.opponent];
  const derby = fixture.opponent === "Manchester City";
  const rival = Boolean(rivalry);
  const atOldTrafford = fixture.isHome;
  const weekend = isWeekend(fixture.kickoffUtc);

  if (rivalry) badges.push(rivalry);
  if (weekend) badges.push({ label: "เตะเสาร์-อาทิตย์ · ลางานน้อย", kind: "weekend" });
  if (fixture.key === cheapestKey) badges.push({ label: "ทริปถูกที่สุด", kind: "value" });

  // ต้องไป = คู่ใหญ่ที่โอลด์ แทรฟฟอร์ด — บรรยากาศเต็มสนามและตั๋วหายากที่สุด
  if (rival && atOldTrafford) {
    badges.unshift({ label: "ต้องไป", kind: "must" });
    return {
      tier: "must",
      tierLabel: "ต้องไป",
      reason: derby
        ? "ดาร์บี้แมนเชสเตอร์ที่โอลด์ แทรฟฟอร์ด — นัดที่คนทั้งเมืองรอทั้งปี"
        : `${rivalry.label} กับ${fixture.opponent} ที่โอลด์ แทรฟฟอร์ด บรรยากาศเต็มสนามแน่นอน`,
      badges,
      special: true,
    };
  }

  // ควรไป = เหย้าที่โอลด์ แทรฟฟอร์ด หรือคู่ใหญ่แม้จะเป็นเกมเยือน
  if (atOldTrafford || rival) {
    badges.unshift({ label: "ควรไป", kind: "should" });
    return {
      tier: "should",
      tierLabel: "ควรไป",
      reason: atOldTrafford
        ? "เกมเหย้าที่โอลด์ แทรฟฟอร์ด — ได้เข้าสนามบ้านของทีมเต็ม ๆ"
        : `${rivalry?.label ?? "เกมเยือน"} ที่สนาม${fixture.opponent} บรรยากาศดี แต่ตั๋วฝั่งทีมเยือนมีจำกัด`,
      badges,
      special: rival,
    };
  }

  return {
    tier: "optional",
    tierLabel: "ไปได้ถ้าวันตรง",
    reason: "เกมเยือนสนามเล็ก เหมาะกับคนที่วันหยุดตรงพอดีหรืออยากได้ทริปประหยัด",
    badges,
    special: false,
  };
}

/** เรียงแมตช์ตามความน่าไป — ใช้กับปุ่ม "เรียงตามคำแนะนำ" */
export function sortByRecommendation(fixtures: PlannableFixture[], cheapestKey?: string) {
  const rank: Record<FixtureTier, number> = { must: 0, should: 1, optional: 2 };
  return [...fixtures].sort((a, b) => {
    const ra = recommendFixture(a, cheapestKey);
    const rb = recommendFixture(b, cheapestKey);
    if (rank[ra.tier] !== rank[rb.tier]) return rank[ra.tier] - rank[rb.tier];
    return new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime();
  });
}
