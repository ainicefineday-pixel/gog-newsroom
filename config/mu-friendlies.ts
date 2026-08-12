// นัดอุ่นเครื่อง — แยกจากปฏิทินพรีเมียร์ลีกโดยตั้งใจ
// ---------------------------------------------------------------------------
// MU_PREMIER_LEAGUE_FIXTURES ต้องมี 38 นัดพอดีและมีเทสต์ล็อกไว้ เพราะมันคือ
// ปฏิทินทางการที่เครื่องมือวางแผนทริปใช้คิดเงินและวีซ่า นัดอุ่นเครื่องไม่ใช่ของชุดนั้น
// จึงอยู่คนละไฟล์ ใครนับจำนวนนัดของฤดูกาลจะได้ไม่นับปนกัน
//
// แถบนัดถัดไปบน nav ต้องมองเห็นทั้งสองชุด ไม่งั้นวันที่มีอุ่นเครื่องแต่ยังไม่เปิดลีก
// แถบจะนับถอยหลังไปนัดที่อยู่อีกสิบวันข้างหน้า ทั้งที่วันนี้ทีมลงเตะจริง

import type { MuFixture } from "@/config/mu-fixtures";

/**
 * ตรวจแล้ววันที่ 12 ส.ค. 2569
 *   เวลาเตะ 19:30 BST และช่องถ่ายทอด ITV1 — Evening Standard
 *     "How to watch Manchester United vs Leeds FOR FREE: TV channel and live
 *      stream for pre-season friendly today" ระบุตรง ๆ ว่า coverage 7pm BST
 *      ahead of kick-off at 7.30pm
 *   สนาม Croke Park — พาดหัว BBC "Man Utd v Leeds - a historic pre-season
 *     encounter at Croke Park"
 *
 * 19:30 BST = 18:30 UTC เก็บเป็น UTC เหมือนปฏิทินลีกเพื่อให้คำนวณร่วมกันได้
 *
 * ลบนัดที่เตะจบแล้วทิ้งได้เลย ไฟล์นี้ไม่มีใครนับจำนวน
 */
export const MU_FRIENDLIES: readonly MuFixture[] = [
  {
    matchday: 0,
    kickoffUtc: "2026-08-12T18:30:00Z",
    home: "Manchester United",
    away: "Leeds United",
    stadium: "Croke Park",
    city: "Dublin",
    status: "confirmed",
    broadcaster: "ITV1",
  },
];
