/**
 * ข่าวรวมและบล็อกสดพูดถึงหลายเหตุการณ์ในชิ้นเดียว จึงห้ามใช้เป็น
 * "แหล่งที่สอง" เพื่อยืนยันข่าวเดี่ยว แม้โมเดลจะจัดมาอยู่กลุ่มเดียวกันก็ตาม
 *
 * กลุ่มที่สองคือชิ้นที่ผูกกับ "นัดหนึ่งนัด" แต่ไม่ได้รายงานเหตุการณ์อะไร —
 * ทิปส์พนัน ตารางถ่ายทอดสด ทำนายผล ตัวจริงที่คาดว่าจะลง โมเดลจับพวกนี้ไปกอง
 * รวมกับข่าวจริงของนัดเดียวกันเพราะพูดถึงนัดเดียวกันจริง ๆ
 *
 * ตรวจกับคลังจริง 12 ส.ค. 2569 เจอ "Man Utd v Leeds - a historic pre-season
 * encounter at Croke Park" ของ BBC ถูกจับคู่กับ "Leeds vs Man Utd betting tips,
 * bet builder and predictions" ของ talkSPORT ซึ่งคนละชิ้นคนละประเภทกันโดยสิ้นเชิง
 * กลุ่มนั้นไม่ผ่านเกณฑ์ยืนยันอยู่แล้ว แต่ชิ้นที่ถูกยุบจะโดนลบทิ้งฟรี ๆ
 */
const ROUNDUP_PATTERN = /\blive\b|\bround-?up\b|rumour mill|gossip|as it happened|latest:|news:/i;

/**
 * ชิ้นที่ผูกกับนัดแต่ไม่ได้รายงานเหตุการณ์ — ยืนยันอะไรให้ใครไม่ได้
 *
 * ยังไม่รวมชิ้น "ตัวจริงที่คาดว่าจะลง" ไว้ที่นี่ ทั้งที่ก็เป็นการเดาเหมือนกัน
 * เพราะเป็นคนละคำถาม: สามสำนักเดาตัวจริงตรงกันควรนับเป็นการยืนยันไหม
 * ถ้าตัดสินว่าไม่ควร ให้เติม predicted line-?up กับ team news เข้ามา
 * แล้วจำนวนข่าวที่ยืนยันผ่านจะลดลงหนึ่งกลุ่มทันที
 */
const MATCH_SERVICE_PATTERN = /betting tips|bet builder|\bodds\b|predictions|how to watch|tv channel|live stream/i;

export function isRoundupHeadline(title: string) {
  return ROUNDUP_PATTERN.test(title) || MATCH_SERVICE_PATTERN.test(title);
}
