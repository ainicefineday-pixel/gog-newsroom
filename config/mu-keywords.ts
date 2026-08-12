import { MU_FIRST_TEAM_SQUAD } from "@/config/mu-squad";

/**
 * Manchester United relevance vocabulary.
 *
 * Keep this list editorially maintained: broad enough to catch player-led
 * stories, but specific enough that a surname alone does not pull in noise.
 *
 * Squad names are NOT written out here — see MU_KEYWORDS below. This list
 * carries club terms, staff, ownership, and spelling variants only.
 */
const EDITORIAL_KEYWORDS = [
  "manchester united",
  "man united",
  "man utd",
  "manchester utd",
  "old trafford",
  "the red devils",
  "carrington",
  "michael carrick",
  "jason wilcox",
  "sir jim ratcliffe",
  "ineos",
  "bruno fernandes",
  "kobbie mainoo",
  "mason mount",
  "manuel ugarte",
  "andrey santos",
  "youri tielemans",
  "matheus cunha",
  "bryan mbeumo",
  "benjamin sesko",
  "benjamin šeško",
  "joshua zirkzee",
  "amad diallo",
  "chido obi",
  "leny yoro",
  "lisandro martinez",
  "lisandro martínez",
  "matthijs de ligt",
  "harry maguire",
  "luke shaw",
  "diogo dalot",
  "noussair mazraoui",
  "patrick dorgu",
  "ayden heaven",
  "altay bayindir",
  "senne lammens",
];

/**
 * ชื่อนักเตะชุดใหญ่ — อ่านจากรายชื่อทางการโดยตรง ไม่พิมพ์ซ้ำไว้ที่นี่
 *
 * รุ่นก่อนพิมพ์มือแล้วตกไป 12 คน (Fredricson, Amass, Collyer, Gore, Darlow,
 * Wheatley, Lacey, Fletcher ทั้งคู่ ฯลฯ) ข่าวที่พาดหัวเอ่ยแค่ชื่อนักเตะพวกนี้
 * โดยไม่มีคำว่า Manchester United จึงถูกตัวกรองทิ้งทั้งที่เป็นข่าวแมนยู
 * ผูกกับ MU_FIRST_TEAM_SQUAD ไว้แล้วจะไม่มีวันตกอีก เพราะแก้ที่เดียวจบ
 *
 * ใช้ชื่อเต็มเท่านั้น ไม่เอา shortName เพราะนามสกุลเดี่ยวอย่าง Mount หรือ Shaw
 * จะลากข่าวที่ไม่เกี่ยวเข้ามาเป็นกอง
 *
 * และตัดชื่อคำเดียวออกด้วย เพราะรายชื่อทางการเขียน Amad ไว้แค่คำเดียว
 * ซึ่งเป็นสตริงย่อยของ "Amadou Onana" ข่าวของคนอื่นจะไหลเข้ามาทันที
 * ชื่อคำเดียวต้องคัดมือลง EDITORIAL_KEYWORDS เอง (ตอนนี้มี "amad diallo" อยู่แล้ว)
 */
const SQUAD_KEYWORDS = MU_FIRST_TEAM_SQUAD
  .map((player) => player.name.toLocaleLowerCase("en"))
  .filter((name) => name.includes(" "));

export const MU_KEYWORDS = [...new Set([...EDITORIAL_KEYWORDS, ...SQUAD_KEYWORDS])];

export const MU_CONTEXT_TERMS = [
  "united",
  "reds",
  "theatre of dreams",
  "premier league",
];

