// วันหยุดราชการไทย — ใช้คำนวณว่าทริปนี้ต้องลางานจริงกี่วัน (STEP 45)
// ---------------------------------------------------------------------------
// ปี 2569 ยืนยันจากปฏิทินวันหยุดราชการ/ธนาคารที่ประกาศแล้ว
// ปี 2570 ยังไม่ประกาศครบ — วันที่ตรึงตามปฏิทินสุริยคติใส่ไว้ได้เลย
// ส่วนวันพระใหญ่ที่อิงจันทรคติ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา)
// ใส่เป็น provisional ไว้ก่อน ต้องมาทานกับประกาศจริงอีกรอบเมื่อ ครม. เคาะ
//
// เก็บเป็น YYYY-MM-DD ค.ศ. ทั้งหมด เพื่อเทียบกับวันเดินทางในระบบได้ตรง ๆ

export type ThaiHoliday = {
  date: string; // YYYY-MM-DD (ค.ศ.)
  name: string;
  /** ยังไม่ประกาศเป็นทางการ — หน้าเว็บต้องบอกผู้ใช้ว่ายังไม่ยืนยัน */
  provisional?: boolean;
};

export const THAI_HOLIDAYS: readonly ThaiHoliday[] = [
  // ── 2026 (พ.ศ. 2569) — ประกาศแล้ว ──────────────────────────────────
  { date: "2026-01-01", name: "วันขึ้นปีใหม่" },
  { date: "2026-01-02", name: "วันหยุดกรณีพิเศษ" },
  { date: "2026-03-03", name: "วันมาฆบูชา" },
  { date: "2026-04-06", name: "วันจักรี" },
  { date: "2026-04-13", name: "วันสงกรานต์" },
  { date: "2026-04-14", name: "วันสงกรานต์" },
  { date: "2026-04-15", name: "วันสงกรานต์" },
  { date: "2026-05-01", name: "วันแรงงานแห่งชาติ" },
  { date: "2026-05-04", name: "วันฉัตรมงคล" },
  { date: "2026-05-13", name: "วันพืชมงคล" },
  { date: "2026-05-31", name: "วันวิสาขบูชา" },
  { date: "2026-06-01", name: "ชดเชยวันวิสาขบูชา" },
  { date: "2026-06-03", name: "วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี" },
  { date: "2026-07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" },
  { date: "2026-07-29", name: "วันอาสาฬหบูชา" },
  { date: "2026-07-30", name: "วันเข้าพรรษา" },
  { date: "2026-08-12", name: "วันแม่แห่งชาติ" },
  { date: "2026-10-13", name: "วันคล้ายวันสวรรคต ร.9" },
  { date: "2026-10-16", name: "วันหยุดพิเศษสถาบันการเงิน" },
  { date: "2026-10-23", name: "วันปิยมหาราช" },
  { date: "2026-12-05", name: "วันพ่อแห่งชาติ" },
  { date: "2026-12-07", name: "ชดเชยวันพ่อแห่งชาติ" },
  { date: "2026-12-10", name: "วันรัฐธรรมนูญ" },
  { date: "2026-12-31", name: "วันสิ้นปี" },

  // ── 2027 (พ.ศ. 2570) — วันที่ตรึงตามปฏิทินสุริยคติ ─────────────────
  { date: "2027-01-01", name: "วันขึ้นปีใหม่" },
  { date: "2027-04-06", name: "วันจักรี" },
  { date: "2027-04-13", name: "วันสงกรานต์" },
  { date: "2027-04-14", name: "วันสงกรานต์" },
  { date: "2027-04-15", name: "วันสงกรานต์" },
  { date: "2027-05-01", name: "วันแรงงานแห่งชาติ" },
  { date: "2027-05-03", name: "ชดเชยวันแรงงาน", provisional: true },
  { date: "2027-05-04", name: "วันฉัตรมงคล" },
  // ── 2027 วันพระใหญ่ตามจันทรคติ — ประมาณการ ต้องทานกับประกาศจริง ────
  { date: "2027-02-21", name: "วันมาฆบูชา", provisional: true },
  { date: "2027-02-22", name: "ชดเชยวันมาฆบูชา", provisional: true },
  { date: "2027-05-20", name: "วันวิสาขบูชา", provisional: true },
];

const HOLIDAY_BY_DATE = new Map(THAI_HOLIDAYS.map((holiday) => [holiday.date, holiday]));

export function thaiHoliday(ymd: string) {
  return HOLIDAY_BY_DATE.get(ymd) ?? null;
}

/** เสาร์หรืออาทิตย์ — คิดตามเวลาไทย ซึ่งเป็นวันที่ผู้ใช้ต้องลางานจริง */
export function isThaiWeekend(ymd: string) {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export type LeaveSummary = {
  /** วันทั้งหมดของทริป */
  totalDays: number;
  /** วันที่ต้องยื่นใบลาจริง */
  leaveDays: number;
  /** เสาร์-อาทิตย์ที่ได้ฟรี */
  weekendDays: number;
  /** วันหยุดราชการที่ตรงกับทริปพอดี */
  holidays: ThaiHoliday[];
};

/**
 * นับว่าทริปช่วงนี้ต้องลางานกี่วัน
 * เกณฑ์: วันจันทร์–ศุกร์ที่ไม่ใช่วันหยุดราชการ = ต้องลา
 * (คนทำงานกะหรือทำงานเสาร์จะต่างออกไป แต่เอาเกณฑ์ออฟฟิศทั่วไปเป็นหลัก)
 */
export function leaveDaysFor(departDate: string, returnDate: string): LeaveSummary | null {
  if (!departDate || !returnDate || returnDate < departDate) return null;
  const holidays: ThaiHoliday[] = [];
  let totalDays = 0;
  let leaveDays = 0;
  let weekendDays = 0;

  const cursor = new Date(`${departDate}T00:00:00Z`);
  const end = new Date(`${returnDate}T00:00:00Z`);
  // ทริปยาวสุดในระบบคือ 10 วัน เผื่อเพดาน 60 กันลูปหลุดถ้าผู้ใช้ใส่วันมั่ว
  while (cursor <= end && totalDays < 60) {
    const ymd = cursor.toISOString().slice(0, 10);
    totalDays += 1;
    const holiday = thaiHoliday(ymd);
    if (isThaiWeekend(ymd)) {
      weekendDays += 1;
      if (holiday) holidays.push(holiday);
    } else if (holiday) {
      holidays.push(holiday);
    } else {
      leaveDays += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { totalDays, leaveDays, weekendDays, holidays };
}
