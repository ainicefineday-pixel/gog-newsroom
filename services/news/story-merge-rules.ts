/**
 * ข่าวรวมและบล็อกสดพูดถึงหลายเหตุการณ์ในชิ้นเดียว จึงห้ามใช้เป็น
 * "แหล่งที่สอง" เพื่อยืนยันข่าวเดี่ยว แม้โมเดลจะจัดมาอยู่กลุ่มเดียวกันก็ตาม
 */
const ROUNDUP_PATTERN = /\blive\b|\bround-?up\b|rumour mill|gossip|as it happened|latest:|news:/i;

export function isRoundupHeadline(title: string) {
  return ROUNDUP_PATTERN.test(title);
}
