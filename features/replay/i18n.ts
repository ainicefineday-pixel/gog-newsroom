import type { MatchEvent, Player } from "./types";

export type ReplayLanguage = "th" | "en";

const THAI_PLAYER_NAMES: Record<string, string> = {
  "Tom Heaton": "ทอม ฮีตัน", "Noussair Mazraoui": "นูสแซร์ มาซราอุย", "Harry Maguire": "แฮร์รี แม็กไกวร์",
  "Ayden Heaven": "เอเดน เฮฟเวน", "Luke Shaw": "ลุค ชอว์", "Andrey Santos": "อันเดรย์ ซานโตส",
  "Mason Mount": "เมสัน เมาท์", "Amad Diallo": "อาหมัด ดิยัลโล", "Shea Lacey": "เช เลซีย์",
  "Patrick Dorgu": "แพทริก ดอร์กู", "Bryan Mbeumo": "ไบรอัน เอ็มเบอโม่", "Dermot Mee": "เดอร์ม็อต มี",
  "Fred Heath": "เฟร็ด ฮีธ", "Harry Amass": "แฮร์รี อามาสส์", "Daniel Armer": "แดเนียล อาร์เมอร์",
  "Diogo Dalot": "ดีโอโก ดาโลต์", "Leny Yoro": "เลนี โยโร", "Bruno Fernandes": "บรูโน แฟร์นันด์ส",
  "Jack Fletcher": "แจ็ก เฟล็ตเชอร์", "Tyler Fletcher": "ไทเลอร์ เฟล็ตเชอร์", "Youri Tielemans": "ยูรี ตีเลอมันส์",
  "Joshua Zirkzee": "โจชัว เซิร์กเซ", "Matvey Safonov": "มัตเวย์ ซาโฟนอฟ", "Illia Zabarnyi": "อิลเลีย ซาบาร์นี",
  "Willian Pacho": "วิลเลียน ปาโช", "Dro Fernández": "โดร เฟร์นันเดซ", "Lucas Beraldo": "ลูคัส เบรัลโด",
  "Senny Mayulu": "เซนนี มายูลู", "Ibrahim Mbaye": "อิบราฮิม เอ็มบาย", "Khvicha Kvaratskhelia": "ควิชา ควารัตสเคเลีย",
  Boly: "โบลี", Koukaba: "คูคาบา", Ayari: "อายารี", Lucea: "ลูเซีย", Idder: "อิดแดร์", "Abo El Nay": "อาโบ เอล นาย",
  "Fanne Drame": "ฟานน์ ดราเม", Bourdin: "บูร์แด็ง", Ndjantou: "เอ็นฌ็องตู", Meite: "เมอิเต", Longoni: "ลองโกนี",
  Marquinhos: "มาร์กินญอส", "Nuno Mendes": "นูโน เมนเดส", Vitinha: "วิตินญา", "João Neves": "ชูเอา เนเวส",
  "Lucas Chevalier": "ลูคัส เชอวาลิเยร์", "Senne Lammens": "เซนเนอ ลัมเมนส์", "Lisandro Martínez": "ลิซานโดร มาร์ติเนซ",
  "Manuel Ugarte": "มานูเอล อูการ์เต", Casemiro: "กาเซมิโร", "Matheus Cunha": "มาเตอุส คุนญา",
  "Benjamin Sesko": "เบนยามิน เชชโก", "Altay Bayındır": "อัลทาย บายินดีร์", "Tyrell Malacia": "ไทเรลล์ มาลาเซีย",
  "Karl Darlow": "คาร์ล ดาร์โลว์", "Jaka Bijol": "ยากา บิโยล", "Pascal Struijk": "ปาสกาล สเตร้าค์",
  "James Justin": "เจมส์ จัสติน", "Jayden Bogle": "เจย์เดน โบเกิล", "Ethan Ampadu": "อีธาน อัมปาดู",
  "Ao Tanaka": "อาโอะ ทานากะ", "Gabriel Gudmundsson": "กาเบรียล กุดมุนด์สสัน", "Brenden Aaronson": "เบรนเดน อารอนสัน",
  "Noah Okafor": "โนอาห์ โอคาฟอร์", "Dominic Calvert-Lewin": "โดมินิก คัลเวิร์ต-ลูวิน", "Wilfried Gnonto": "วิลฟรีด ญอนโต",
  "Ilia Gruev": "อิเลีย กรูเยฟ", "Sean Longstaff": "ฌอน ลองสตาฟฟ์", "Lukas Nmecha": "ลูคัส เอ็นเมชา",
  "Sam Byram": "แซม ไบรัม", "Lucas Perri": "ลูคัส แปร์รี", "Sebastiaan Bornauw": "เซบาสเตียน บอร์เนาว์", "Joël Piroe": "โยเอล ปีรู",
  "Facundo Buonanotte": "ฟากุนโด บูโอนาน็อตเต",
};

export function playerName(player: Player, lang: ReplayLanguage, short = false) {
  if (lang === "en") return short ? player.shortName : player.name;
  const translated = THAI_PLAYER_NAMES[player.name];
  if (!translated) return short ? player.shortName : player.name;
  return short ? translated.split(" ").at(-1)! : translated;
}
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
  let translatedCommentary = event.commentary;
  for (const [english, thai] of Object.entries(THAI_PLAYER_NAMES).sort((a, b) => b[0].length - a[0].length)) {
    translatedCommentary = translatedCommentary.replaceAll(english, thai);
  }
  const shortAliases: Record<string, string> = {
    Amad: "อาหมัด", Mbeumo: "เอ็มเบอโม่", Mount: "เมาท์", Okafor: "โอคาฟอร์", Casemiro: "กาเซมิโร",
    Martinez: "มาร์ติเนซ", Martínez: "มาร์ติเนซ", Fernandes: "แฟร์นันด์ส", Safonov: "ซาโฟนอฟ",
    Heaven: "เฮฟเวน", Lammens: "ลัมเมนส์", Sesko: "เชชโก", Tanaka: "ทานากะ", "Calvert-Lewin": "คัลเวิร์ต-ลูวิน",
  };
  for (const [english, thai] of Object.entries(shortAliases)) {
    translatedCommentary = translatedCommentary.replace(new RegExp(`\\b${english}\\b`, "g"), thai);
  }
  const names = translatedCommentary
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
