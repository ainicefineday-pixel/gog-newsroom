// เวลาหลังเกม — ตรรกะล้วน ไม่พึ่งปฏิทินนัดและไม่พึ่งอะไรทั้งสิ้น
// ---------------------------------------------------------------------------
// แยกออกมาจาก next-match เพราะทั้งแถบบน nav ครอนหาคลิปหลังเกม และรายงานผล
// ใช้เส้นเวลาชุดเดียวกัน ถ้าต่างคนต่างคิดเอง วันหนึ่งมันจะเลื่อนออกจากกัน
//
// อยู่แยกไฟล์ยังทำให้เทสต์เรียกได้ตรง ๆ ด้วย — ไฟล์นี้ไม่มี import สักบรรทัด

/** นาทีที่ครึ่งหลังควรจบ นับจากเขี่ยบอล — 45 + 15 พักครึ่ง + 45 */
export const FULL_TIME_MINUTES = 105;

/** ช่วงที่ยังถือว่าเป็น "ช่วงหลังเกม" ของนัดนั้นบนหน้าเว็บ */
export const POST_MATCH_WINDOW_MINUTES = 30;

/** ผ่านมากี่นาทีตั้งแต่เวลาจบเกมของนัดนี้ — ติดลบแปลว่ายังไม่จบ */
export function minutesSinceFullTime(kickoffUtc: string, now: number) {
  const fullTime = new Date(kickoffUtc).getTime() + FULL_TIME_MINUTES * 60_000;
  return (now - fullTime) / 60_000;
}

/**
 * นัดที่เพิ่งจบไปภายในหน้าต่างที่กำหนด — คืน null เมื่อไม่มีนัดไหนอยู่ในช่วงนั้น
 *
 * ไล่จากท้ายรายการเพราะนัดที่จบล่าสุดคือนัดที่เวลาเตะมากที่สุดที่ยังไม่เกินหน้าต่าง
 * ผู้เรียกส่งรายการที่เรียงตามเวลาเตะแล้วมาให้
 */
export function pickFinishedMatch<T extends { kickoffUtc: string }>(
  matches: readonly T[],
  windowMinutes: number,
  now: number,
): T | null {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const elapsed = minutesSinceFullTime(matches[index].kickoffUtc, now);
    if (elapsed >= 0 && elapsed <= windowMinutes) return matches[index];
  }
  return null;
}
