// คลังสถานที่สำหรับสร้างแผนเที่ยว — แยกตามเมืองและประเภท (STEP 13, 16, 17)
// ข้อมูลสถานที่เป็นของจริง ส่วนราคา/เวลาเปิดเป็นค่าประมาณการเพื่อวางแผน (STEP 32)

import type { DestinationCity } from "@/services/trip/types";

export type PlaceKind =
  | "football"      // สนาม พิพิธภัณฑ์สโมสร ประวัติศาสตร์บอล
  | "pilgrimage"    // หมุดสำคัญที่แฟนบอลจริงจังควรไป
  | "attraction"    // ที่เที่ยวทั่วไป
  | "food"          // ร้านอาหาร
  | "thai-food"     // อาหารไทย
  | "coffee"        // กาแฟ specialty
  | "pub"           // ผับสายบอล
  | "shopping";

export type Place = {
  id: string;
  city: DestinationCity;
  kind: PlaceKind;
  name: string;
  area: string;
  /** นาทีที่ควรเผื่อไว้สำหรับสถานที่นี้ */
  durationMinutes: number;
  /** บาทต่อคน — 0 = เข้าฟรี */
  costThb: number;
  /** ยิ่งสูงยิ่งควรจัดให้ก่อน (คะแนนความเกี่ยวข้องกับสายบอล + ความน่าสนใจ) */
  score: number;
  /** ทำไมถึงแนะนำ — ใช้เป็นคำอธิบายใต้ชื่อ */
  why: string;
  /** ต้องจองล่วงหน้าไหม */
  booking?: boolean;
  /** เฉพาะหมุด pilgrimage — ความสำคัญทางประวัติศาสตร์ */
  significance?: string;
};

export const PLACES: Place[] = [
  // ═══ แมนเชสเตอร์ ═══════════════════════════════════════════════════════
  {
    id: "man-ot-tour",
    city: "Manchester",
    kind: "football",
    name: "ทัวร์สนามโอลด์ แทรฟฟอร์ด + พิพิธภัณฑ์",
    area: "Old Trafford",
    durationMinutes: 150,
    costThb: 1_500,
    score: 98,
    why: "เดินอุโมงค์นักเตะ นั่งม้านั่งสำรอง เข้าห้องแต่งตัว และดูถ้วยรางวัลครบทุกใบ",
    booking: true,
  },
  {
    id: "man-megastore",
    city: "Manchester",
    kind: "shopping",
    name: "United Megastore",
    area: "Old Trafford",
    durationMinutes: 60,
    costThb: 0,
    score: 82,
    why: "ร้านค้าทางการที่ใหญ่ที่สุด สกรีนชื่อ-เบอร์บนเสื้อได้ที่นี่ที่เดียว",
  },
  {
    id: "man-football-museum",
    city: "Manchester",
    kind: "football",
    name: "National Football Museum",
    area: "Cathedral Gardens",
    durationMinutes: 120,
    costThb: 600,
    score: 90,
    why: "พิพิธภัณฑ์ฟุตบอลแห่งชาติของอังกฤษ เล่าตั้งแต่ต้นกำเนิดเกมจนถึงพรีเมียร์ลีก",
  },
  {
    id: "man-etihad-tour",
    city: "Manchester",
    kind: "football",
    name: "ทัวร์เอติฮัด สเตเดียม",
    area: "Etihad Campus",
    durationMinutes: 120,
    costThb: 1_300,
    score: 62,
    why: "อีกฝั่งของเมือง เห็นภาพว่าดาร์บี้แมนเชสเตอร์ยิ่งใหญ่แค่ไหนจากทั้งสองด้าน",
    booking: true,
  },
  {
    id: "man-munich-tunnel",
    city: "Manchester",
    kind: "pilgrimage",
    name: "อนุสรณ์มิวนิก + นาฬิกามิวนิก",
    area: "Old Trafford (ฝั่ง East Stand)",
    durationMinutes: 30,
    costThb: 0,
    score: 96,
    why: "จุดรำลึกโศกนาฏกรรมมิวนิก 1958 ที่แฟนผีทุกคนควรมายืนสักครั้ง",
    significance: "เครื่องบินตกที่มิวนิกคร่าชีวิตนักเตะ Busby Babes 8 คน จุดเปลี่ยนที่สุดในประวัติศาสตร์สโมสร",
  },
  {
    id: "man-trinity",
    city: "Manchester",
    kind: "pilgrimage",
    name: "รูปปั้น The United Trinity",
    area: "Old Trafford (Sir Matt Busby Way)",
    durationMinutes: 20,
    costThb: 0,
    score: 92,
    why: "เบสต์ ลอว์ ชาร์ลตัน ยืนหันหน้าเข้าหารูปปั้นเซอร์แมตต์ บัสบี้ — จุดถ่ายรูปคลาสสิก",
    significance: "สามนักเตะที่พาทีมคว้าแชมป์ยุโรปปี 1968 หลังเหตุการณ์มิวนิก 10 ปี",
  },
  {
    id: "man-northern-quarter",
    city: "Manchester",
    kind: "attraction",
    name: "เดินเล่น Northern Quarter",
    area: "Northern Quarter",
    durationMinutes: 120,
    costThb: 0,
    score: 78,
    why: "ย่านสตรีทอาร์ต แผ่นเสียง และร้านอิสระ หัวใจของวัฒนธรรมเมืองแมนเชสเตอร์",
  },
  {
    id: "man-science-museum",
    city: "Manchester",
    kind: "attraction",
    name: "Science and Industry Museum",
    area: "Castlefield",
    durationMinutes: 100,
    costThb: 0,
    score: 66,
    why: "เข้าฟรี เล่าเรื่องเมืองอุตสาหกรรมแห่งแรกของโลก ซึ่งเป็นรากของสโมสรทั้งสองทีม",
  },
  {
    id: "man-coffee-idle",
    city: "Manchester",
    kind: "coffee",
    name: "ร้านกาแฟคั่วเองย่าน Northern Quarter",
    area: "Northern Quarter",
    durationMinutes: 45,
    costThb: 250,
    score: 72,
    why: "ย่านที่ร้านคั่วเองหนาแน่นที่สุดในเมือง เหมาะแวะก่อนเดินสำรวจต่อ",
  },
  {
    id: "man-pub-bishop",
    city: "Manchester",
    kind: "pub",
    name: "ผับสายบอลรอบโอลด์ แทรฟฟอร์ด",
    area: "Old Trafford / Trafford Bar",
    durationMinutes: 90,
    costThb: 700,
    score: 85,
    why: "บรรยากาศแฟนบอลก่อน-หลังเกม ร้องเพลงเชียร์กับคนท้องถิ่นจริง ๆ",
  },
  {
    id: "man-food-curry",
    city: "Manchester",
    kind: "food",
    name: "Curry Mile ย่าน Rusholme",
    area: "Rusholme",
    durationMinutes: 90,
    costThb: 600,
    score: 70,
    why: "ถนนอาหารเอเชียใต้ที่ยาวที่สุดในอังกฤษ ราคาเป็นมิตรและเปิดดึก",
  },
  {
    id: "man-thai-food",
    city: "Manchester",
    kind: "thai-food",
    name: "ร้านอาหารไทยย่านใจกลางเมือง",
    area: "City Centre",
    durationMinutes: 75,
    costThb: 850,
    score: 60,
    why: "ทริปยาว ๆ กินมันฝรั่งทุกวันจะคิดถึงข้าว — แวะเติมพลังกลางทริป",
  },

  // ═══ ลอนดอน ════════════════════════════════════════════════════════════
  {
    id: "lon-emirates-tour",
    city: "London",
    kind: "football",
    name: "ทัวร์เอมิเรตส์ สเตเดียม",
    area: "Holloway",
    durationMinutes: 120,
    costThb: 1_400,
    score: 84,
    why: "ออดิโอไกด์เสียงตำนานอาร์เซนอล พร้อมพิพิธภัณฑ์สโมสร",
    booking: true,
  },
  {
    id: "lon-wembley",
    city: "London",
    kind: "pilgrimage",
    name: "เวมบลีย์ สเตเดียม",
    area: "Wembley",
    durationMinutes: 150,
    costThb: 1_100,
    score: 94,
    why: "บ้านของฟุตบอลอังกฤษ เดินขึ้นบันไดไปยกถ้วยที่จุดเดียวกับกัปตันทีมแชมป์",
    significance: "สนามที่ยูไนเต็ดคว้าแชมป์ยุโรปครั้งแรกปี 1968 และเป็นสนามชิงเอฟเอคัพ",
    booking: true,
  },
  {
    id: "lon-stamford-tour",
    city: "London",
    kind: "football",
    name: "ทัวร์สแตมฟอร์ด บริดจ์",
    area: "Fulham",
    durationMinutes: 105,
    costThb: 1_300,
    score: 70,
    why: "สนามเก่าแก่ใจกลางลอนดอน เดินจากสถานีฟูแลม บรอดเวย์ไม่ถึง 5 นาที",
    booking: true,
  },
  {
    id: "lon-tottenham-tour",
    city: "London",
    kind: "football",
    name: "ทัวร์ท็อตแนม ฮอตสเปอร์ สเตเดียม",
    area: "Tottenham",
    durationMinutes: 120,
    costThb: 1_500,
    score: 74,
    why: "สนามใหม่ที่ล้ำที่สุดในอังกฤษ มีสนามหญ้าเลื่อนได้และโรงเบียร์ในสนาม",
    booking: true,
  },
  {
    id: "lon-british-museum",
    city: "London",
    kind: "attraction",
    name: "British Museum",
    area: "Bloomsbury",
    durationMinutes: 150,
    costThb: 0,
    score: 80,
    why: "เข้าฟรี ของสะสมระดับโลก เดินได้ทั้งวันหรือเลือกดูเฉพาะโซนก็ได้",
  },
  {
    id: "lon-westminster",
    city: "London",
    kind: "attraction",
    name: "เวสต์มินสเตอร์ + บิ๊กเบน + ลอนดอนอาย",
    area: "Westminster",
    durationMinutes: 120,
    costThb: 0,
    score: 76,
    why: "เดินเส้นแลนด์มาร์กริมแม่น้ำเทมส์ เก็บภาพลอนดอนที่จำได้ทันที",
  },
  {
    id: "lon-borough-market",
    city: "London",
    kind: "food",
    name: "Borough Market",
    area: "Southwark",
    durationMinutes: 90,
    costThb: 700,
    score: 79,
    why: "ตลาดอาหารเก่าแก่ที่สุดของลอนดอน ชิมทีละร้านได้ทั้งมื้อ",
  },
  {
    id: "lon-coffee-shoreditch",
    city: "London",
    kind: "coffee",
    name: "ร้านกาแฟ specialty ย่าน Shoreditch",
    area: "Shoreditch",
    durationMinutes: 45,
    costThb: 280,
    score: 71,
    why: "ต้นกำเนิดคลื่นกาแฟลูกที่สามของลอนดอน ร้านคั่วเองเดินถึงกันหมด",
  },
  {
    id: "lon-thai-food",
    city: "London",
    kind: "thai-food",
    name: "ร้านอาหารไทยย่านโซho / ไชน่าทาวน์",
    area: "Soho",
    durationMinutes: 75,
    costThb: 900,
    score: 62,
    why: "ตัวเลือกอาหารไทยเยอะที่สุดในอังกฤษ อยู่กลางเมืองเดินถึงจากโรงละคร",
  },
  {
    id: "lon-pub-football",
    city: "London",
    kind: "pub",
    name: "ผับดูบอลย่านใจกลางเมือง",
    area: "Soho / Covent Garden",
    durationMinutes: 90,
    costThb: 800,
    score: 75,
    why: "ดูเกมอื่นในวันที่ไม่มีนัดของเรา บรรยากาศแฟนบอลอังกฤษเต็มร้าน",
  },
  {
    id: "lon-oxford-street",
    city: "London",
    kind: "shopping",
    name: "Oxford Street + Regent Street",
    area: "West End",
    durationMinutes: 150,
    costThb: 0,
    score: 64,
    why: "ถนนช้อปหลัก เดินยาวได้ตั้งแต่บ่ายถึงค่ำ",
  },
];

export function placesIn(city: DestinationCity, kinds: PlaceKind[]) {
  return PLACES
    .filter((place) => place.city === city && kinds.includes(place.kind))
    .sort((a, b) => b.score - a.score);
}

export function pilgrimageIn(city: DestinationCity) {
  return placesIn(city, ["pilgrimage"]);
}
