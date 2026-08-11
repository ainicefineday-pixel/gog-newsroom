// พจนานุกรมฟุตบอลไทยของ GOG (STEP 21, 26, 27, 28)
// ---------------------------------------------------------------------------
// เก็บคำแปลไว้ถาวร ไม่ยิงให้ AI แปลใหม่ทุกครั้งที่เปิดหน้า — ทั้งช้า ทั้งเปลืองเงิน
// และคำแปลจะไม่นิ่ง ชื่อทีมกับศัพท์สถิติต้องเหมือนกันทุกหน้าเสมอ
//
// ทีมงานแก้คำแปลได้ที่ไฟล์นี้ที่เดียว ถือเป็นฉบับที่ยืนยันแล้ว

import type { FixtureState } from "@/services/football/types";

export const THAI_DICTIONARY_VERSION = "2026.08.1";

/** สถานะแมตช์ — ห้ามให้โค้ดดิบของผู้ให้บริการโผล่บนหน้าเว็บ (STEP 21) */
export const FIXTURE_STATE_TH: Record<FixtureState, string> = {
  pre: "ยังไม่เริ่ม",
  live: "กำลังแข่งขัน",
  half_time: "พักครึ่ง",
  full_time: "จบการแข่งขัน",
  postponed: "เลื่อนการแข่งขัน",
  cancelled: "ยกเลิก",
  abandoned: "ยุติการแข่งขัน",
  unknown: "ไม่ทราบสถานะ",
};

/** ศัพท์สถิติ — คู่ไทย/อังกฤษ ให้ผู้ใช้เรียนศัพท์ไปด้วย (STEP 26, 110) */
export const STAT_LABELS: Record<string, { th: string; en: string; hint?: string }> = {
  possession: { th: "การครองบอล", en: "Ball Possession" },
  shots: { th: "ยิงทั้งหมด", en: "Total Shots" },
  shotsOnTarget: { th: "ยิงเข้ากรอบ", en: "Shots on Goal" },
  shotsOffTarget: { th: "ยิงไม่เข้ากรอบ", en: "Shots off Goal" },
  blockedShots: { th: "ยิงติดบล็อก", en: "Blocked Shots" },
  corners: { th: "เตะมุม", en: "Corner Kicks" },
  fouls: { th: "ฟาวล์", en: "Fouls" },
  offsides: { th: "ล้ำหน้า", en: "Offsides" },
  saves: { th: "เซฟของผู้รักษาประตู", en: "Goalkeeper Saves" },
  passes: { th: "จ่ายบอล", en: "Passes" },
  passAccuracy: { th: "ความแม่นยำในการจ่ายบอล", en: "Pass Accuracy" },
  yellowCards: { th: "ใบเหลือง", en: "Yellow Cards" },
  redCards: { th: "ใบแดง", en: "Red Cards" },
};

/** ศัพท์ขั้นสูง เตรียมไว้สำหรับตอนมีข้อมูลระดับพิกัด (STEP 27) */
export const ADVANCED_TERMS: Record<string, { th: string; en: string; hint: string }> = {
  xg: { th: "ค่าคาดการณ์ประตู", en: "Expected Goals (xG)", hint: "ประเมินว่าโอกาสยิงแต่ละครั้งควรกลายเป็นประตูมากแค่ไหน" },
  xa: { th: "ค่าคาดการณ์แอสซิสต์", en: "Expected Assists (xA)", hint: "ประเมินว่าการจ่ายบอลควรกลายเป็นแอสซิสต์มากแค่ไหน" },
  ppda: { th: "ดัชนีความเข้มข้นในการเพรส", en: "PPDA", hint: "ยิ่งค่าน้อยยิ่งไล่บี้คู่แข่งหนัก" },
  fieldTilt: { th: "สัดส่วนการครองพื้นที่เกมรุก", en: "Field Tilt", hint: "ส่วนแบ่งการครองบอลเฉพาะในแดนสุดท้าย" },
  progressivePass: { th: "การจ่ายบอลพาขึ้นหน้า", en: "Progressive Pass", hint: "จ่ายบอลที่พาทีมเข้าใกล้ประตูคู่แข่งอย่างมีนัยสำคัญ" },
  halfSpace: { th: "ฮาล์ฟสเปซ", en: "Half-space", hint: "ช่องระหว่างริมเส้นกับกลางสนาม จุดที่เจาะเกมรับได้ดีที่สุด" },
};

export const EVENT_LABELS_TH: Record<string, string> = {
  goal: "ประตู",
  own_goal: "ทำเข้าประตูตัวเอง",
  penalty: "จุดโทษ",
  penalty_miss: "ยิงจุดโทษไม่เข้า",
  yellow_card: "ใบเหลือง",
  red_card: "ใบแดง",
  second_yellow: "ใบเหลืองใบที่สอง",
  substitution: "เปลี่ยนตัว",
  var: "VAR",
};

/**
 * ชื่อไทยประจำสโมสร — ฉบับที่ยืนยันแล้ว (STEP 28)
 * คีย์เป็นชื่ออังกฤษทางการ ส่วน aliases ใช้จับคู่ชื่อที่ผู้ให้บริการแต่ละเจ้าเขียนไม่เหมือนกัน
 */
export type TeamNameRecord = { th: string; short: string; aliases: string[] };

export const TEAM_NAMES: Record<string, TeamNameRecord> = {
  "Manchester United": { th: "แมนเชสเตอร์ ยูไนเต็ด", short: "แมนยู", aliases: ["Man United", "Man Utd", "Manchester Utd", "MUN"] },
  "Manchester City": { th: "แมนเชสเตอร์ ซิตี้", short: "แมนซิตี้", aliases: ["Man City", "MCI"] },
  Arsenal: { th: "อาร์เซนอล", short: "อาร์เซนอล", aliases: ["ARS"] },
  Liverpool: { th: "ลิเวอร์พูล", short: "ลิเวอร์พูล", aliases: ["LIV"] },
  Chelsea: { th: "เชลซี", short: "เชลซี", aliases: ["CHE"] },
  "Tottenham Hotspur": { th: "ท็อตแนม ฮ็อตสเปอร์", short: "สเปอร์ส", aliases: ["Tottenham", "Spurs", "TOT"] },
  "Newcastle United": { th: "นิวคาสเซิล ยูไนเต็ด", short: "นิวคาสเซิล", aliases: ["Newcastle", "NEW"] },
  "Aston Villa": { th: "แอสตัน วิลลา", short: "วิลลา", aliases: ["AVL"] },
  Everton: { th: "เอฟเวอร์ตัน", short: "เอฟเวอร์ตัน", aliases: ["EVE"] },
  "West Ham United": { th: "เวสต์แฮม ยูไนเต็ด", short: "เวสต์แฮม", aliases: ["West Ham", "WHU"] },
  Brentford: { th: "เบรนต์ฟอร์ด", short: "เบรนต์ฟอร์ด", aliases: ["BRE"] },
  "Brighton & Hove Albion": { th: "ไบรท์ตัน แอนด์ โฮฟ อัลเบียน", short: "ไบรท์ตัน", aliases: ["Brighton", "BHA"] },
  "Crystal Palace": { th: "คริสตัล พาเลซ", short: "พาเลซ", aliases: ["CRY"] },
  Fulham: { th: "ฟูแลม", short: "ฟูแลม", aliases: ["FUL"] },
  "Nottingham Forest": { th: "น็อตติงแฮม ฟอเรสต์", short: "ฟอเรสต์", aliases: ["Nott'm Forest", "NFO"] },
  "AFC Bournemouth": { th: "เอเอฟซี บอร์นมัธ", short: "บอร์นมัธ", aliases: ["Bournemouth", "BOU"] },
  "Leeds United": { th: "ลีดส์ ยูไนเต็ด", short: "ลีดส์", aliases: ["Leeds", "LEE"] },
  "Ipswich Town": { th: "อิปสวิช ทาวน์", short: "อิปสวิช", aliases: ["Ipswich", "IPS"] },
  Sunderland: { th: "ซันเดอร์แลนด์", short: "ซันเดอร์แลนด์", aliases: ["SUN"] },
  "Hull City": { th: "ฮัลล์ ซิตี้", short: "ฮัลล์", aliases: ["Hull", "HUL"] },
  "Coventry City": { th: "โคเวนทรี ซิตี้", short: "โคเวนทรี", aliases: ["Coventry", "COV"] },
  "Wolverhampton Wanderers": { th: "วูล์ฟแฮมป์ตัน วันเดอเรอร์ส", short: "วูล์ฟส์", aliases: ["Wolves", "WOL"] },
  "Leicester City": { th: "เลสเตอร์ ซิตี้", short: "เลสเตอร์", aliases: ["Leicester", "LEI"] },
  "Southampton": { th: "เซาแธมป์ตัน", short: "เซาแธมป์ตัน", aliases: ["SOU"] },
};

/**
 * คำบอกประเภทสโมสรที่ผู้ให้บริการแต่ละเจ้าเติมไม่เหมือนกัน
 * football-data.org ส่ง "Arsenal FC" / "Hull City AFC" ส่วน API-Football ส่ง "Arsenal"
 * ถ้าไม่ตัดออกก่อนเทียบ จะกลายเป็นคนละทีมกันทันที ทั้งชื่อไทยและ id ของ GOG
 *
 * ต้องประกาศไว้เหนือ ALIAS_TO_OFFICIAL เพราะลูปข้างล่างเรียก normalizeName
 * ตั้งแต่ตอนโหลดโมดูล ถ้าอยู่ใต้จะติด temporal dead zone
 */
const CLUB_TYPE_TOKENS = new Set(["fc", "afc", "cf", "sc", "ac"]);

// ตารางกลับด้าน สร้างครั้งเดียวตอนโหลดโมดูล ใช้จับ alias ให้ชี้กลับไปชื่อทางการ
const ALIAS_TO_OFFICIAL = new Map<string, string>();
for (const [official, record] of Object.entries(TEAM_NAMES)) {
  ALIAS_TO_OFFICIAL.set(normalizeName(official), official);
  ALIAS_TO_OFFICIAL.set(normalizeName(record.th), official);
  for (const alias of record.aliases) ALIAS_TO_OFFICIAL.set(normalizeName(alias), official);
}

/** ตัดอักขระและคำต่อท้ายที่ผู้ให้บริการเขียนไม่ตรงกันก่อนจับคู่ (STEP 13) */
export function normalizeName(value: string) {
  const base = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[.'`’-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = base.split(" ");
  // ตัดเฉพาะหัวกับท้าย ไม่ตัดกลางชื่อ เพราะบางสโมสรมีคำพวกนี้อยู่กลางชื่อจริง ๆ
  while (tokens.length > 1 && CLUB_TYPE_TOKENS.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && CLUB_TYPE_TOKENS.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

/** หาชื่อทางการจากชื่อที่ผู้ให้บริการส่งมา — คืน null เมื่อยังไม่รู้จัก */
export function resolveOfficialName(value: string): string | null {
  return ALIAS_TO_OFFICIAL.get(normalizeName(value)) ?? null;
}

/** ชื่อไทยของทีม — ยังไม่มีในพจนานุกรมก็คืนชื่ออังกฤษไปก่อน ไม่เดาคำแปลเอง */
export function thaiTeamName(value: string) {
  const official = resolveOfficialName(value);
  return official ? TEAM_NAMES[official].th : value;
}

export function thaiTeamShortName(value: string) {
  const official = resolveOfficialName(value);
  return official ? TEAM_NAMES[official].short : value;
}

/** รายชื่อทีมที่ยังไม่มีคำแปลไทย — หน้าแอดมินเอาไปไล่เติมได้ (STEP 94) */
export function unmappedTeamNames(names: string[]) {
  return [...new Set(names.filter((name) => !resolveOfficialName(name)))];
}
