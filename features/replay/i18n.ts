import type { MatchEvent } from "./types";

export type ReplayLanguage = "th" | "en";
export const ui = {
  th: {
    newsroom: "กลับ GOG NEWSROOM",
    lab: "GOG ห้องทดลองรีเพลย์แท็กติก",
    hero: "สองแมตช์ ทุกนาที",
    heroEm: "เห็นเกมในมุมที่รายงานข่าวเล่าไม่หมด",
    intro:
      "รีเพลย์แท็กติกแบบโต้ตอบ สร้างจากรายงานการแข่งขัน โดยล็อกข้อเท็จจริงที่ยืนยันแล้ว และระบุส่วนจำลองไว้อย่างตรงไปตรงมา",
    open: "เปิดรีเพลย์",
    method: "ที่มาข้อมูลและข้อจำกัด",
    seeded: "จำลองซ้ำได้จาก Seed เดิม · ไม่เรียก Sports API ระหว่างใช้งาน",
    notice: "รีเพลย์แท็กติกที่สร้างขึ้นใหม่",
    noticeBody:
      "คงผลการแข่งขัน ประตู ใบแดงใบเหลือง การเปลี่ยนตัว และสถิติรวมที่ยืนยันได้ ส่วนการเคลื่อนที่ วิถีบอล พิกัดเหตุการณ์ และจังหวะประกอบเป็นภาพจำลอง ไม่ใช่ข้อมูล Tracking อย่างเป็นทางการ",
    library: "คลังแมตช์",
    timeline: "รายงานนาทีต่อนาที",
    stats: "สถิติสด",
    analytics: "วิเคราะห์เกม",
    report: "รายงานหลังเกม",
    all: "ทุกเหตุการณ์",
    goals: "ประตู",
    shots: "โอกาสยิง",
    cards: "ใบลงโทษ",
    subs: "เปลี่ยนตัว",
    confirmed: "เฉพาะที่ยืนยัน",
    labels: "ชื่อผู้เล่น",
    trails: "เส้นทางวิ่ง",
    zones: "โซนแท็กติก",
    second: "ครึ่งหลัง",
    restart: "เริ่มใหม่",
    replay: "ดูรีเพลย์อีกครั้ง",
    another: "เลือกแมตช์อื่น",
    play: "เล่น",
    pause: "หยุด",
    dataExplain: "คำอธิบายข้อมูล",
  },
  en: {
    newsroom: "BACK TO GOG NEWSROOM",
    lab: "GOG TACTICAL REPLAY LAB",
    hero: "Two matches. Every minute.",
    heroEm: "See what the match report cannot show",
    intro:
      "Interactive tactical replays built from published reports, with confirmed facts locked and every simulated layer labelled clearly.",
    open: "OPEN REPLAY",
    method: "Data methodology & limitations",
    seeded: "Deterministic seeded reconstruction · no runtime sports API",
    notice: "Reconstructed tactical replay",
    noticeBody:
      "Confirmed results, goals, cards, substitutions and aggregate statistics are preserved. Player movement, ball trajectories, event locations and supporting actions are simulations—not official tracking data.",
    library: "MATCH LIBRARY",
    timeline: "Timeline",
    stats: "Live statistics",
    analytics: "Analytics",
    report: "Post-match report",
    all: "All events",
    goals: "Goals",
    shots: "Shots",
    cards: "Cards",
    subs: "Substitutions",
    confirmed: "Confirmed only",
    labels: "Labels",
    trails: "Trails",
    zones: "Tactical zones",
    second: "Second half",
    restart: "Restart",
    replay: "REPLAY MATCH",
    another: "CHOOSE ANOTHER MATCH",
    play: "Play",
    pause: "Pause",
    dataExplain: "Data explanation",
  },
} as const;

const thaiType: Record<MatchEvent["type"], string> = {
  kickoff: "เริ่มการแข่งขัน",
  pass: "ต่อบอล",
  carry: "พาบอล",
  cross: "เปิดบอล",
  tackle: "เข้าสกัด",
  interception: "ตัดบอล",
  recovery: "เก็บบอลคืน",
  foul: "ฟาวล์",
  corner: "เตะมุม",
  offside: "ล้ำหน้า",
  shot: "ยิง",
  save: "เซฟ",
  goal: "ประตู",
  "yellow-card": "ใบเหลือง",
  "red-card": "ใบแดง",
  injury: "บาดเจ็บ",
  substitution: "เปลี่ยนตัว",
  "half-time": "พักครึ่ง",
  "second-half": "เริ่มครึ่งหลัง",
  "full-time": "จบการแข่งขัน",
};

export function eventCopy(event: MatchEvent, lang: ReplayLanguage) {
  if (lang === "en") return event.commentary;
  const names = event.commentary
    .replace(
      "Kick-off at Ullevi Stadium. Both teams settle into their starting shapes.",
      "เริ่มเกมที่อุลเลวี สเตเดียม ทั้งสองทีมจัดระเบียบตามรูปแบบตั้งต้น",
    )
    .replace("Kick-off at Old Trafford.", "เริ่มเกมที่โอลด์ แทรฟฟอร์ด")
    .replace("Full-time:", "จบเกม:")
    .replace("Half-time:", "พักครึ่ง:")
    .replace("scores for Leeds", "ยิงให้ลีดส์ขึ้นนำ")
    .replace(
      "is shown a straight red card after VAR review",
      "ถูกไล่ออกด้วยใบแดงโดยตรงหลัง VAR ตรวจสอบ",
    )
    .replace("replaces", "ลงมาแทน")
    .replace("is booked", "รับใบเหลือง")
    .replace("scores", "ทำประตู");
  if (names !== event.commentary) return names;
  const team =
    event.teamId === "mufc"
      ? "แมนเชสเตอร์ ยูไนเต็ด"
      : event.teamId === "psg"
        ? "เปแอสเช"
        : "ลีดส์ ยูไนเต็ด";
  return `${thaiType[event.type]}ของ${team} — ${event.dataStatus === "confirmed" ? "จังหวะนี้ยืนยันจากรายงานการแข่งขัน" : "จังหวะประกอบนี้จำลองจากรูปเกมและสถิติรวม"}`;
}
