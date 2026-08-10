// วีซ่าอังกฤษสำหรับผู้ถือพาสปอร์ตไทย (STEP 41)
// ---------------------------------------------------------------------------
// คนไทยต้องขอ Standard Visitor visa ก่อนบินเสมอ — ไม่เข้าข่าย ETA
// ตรรกะและตัวเลขทั้งหมดอยู่ที่นี่ที่เดียว UI แค่เรียกไปวาด (STEP 31)
//
// ค่าธรรมเนียมรัฐเป็นปอนด์ตามตาราง gov.uk ส่วนค่าบริการ VFS เป็นบาทตามที่
// ศูนย์กรุงเทพฯ เก็บ — ทั้งคู่ขยับปีละครั้งอย่างน้อย จึงรวมไว้ที่เดียวพร้อม
// FEES_UPDATED ให้ไล่แก้ได้จบในไฟล์นี้

import { GBP_TO_THB } from "@/services/pricing";
import type { CostLine } from "@/services/trip/types";

/** วันที่ทีมงานทานตัวเลขค่าธรรมเนียมล่าสุด — แสดงบนหน้าเว็บให้ผู้ใช้รู้ว่าข้อมูลเก่าแค่ไหน */
export const FEES_UPDATED = "2025-04-09";

export type VisaTypeId = "visit6m" | "visit2y" | "visit5y" | "visit10y";

export type VisaType = {
  id: VisaTypeId;
  name: string;
  /** ค่าธรรมเนียมรัฐบาลอังกฤษ ต่อคน (ปอนด์) */
  feeGbp: number;
  /** อยู่ได้ครั้งละกี่วันต่อการเข้าประเทศหนึ่งครั้ง */
  maxStayDays: number;
  tagline: string;
  bestFor: string;
  /** ประหยัดกว่าการต่ออายุทีละ 6 เดือนเมื่อไปกี่ครั้ง — ใช้โชว์จุดคุ้มทุน */
  breakEvenTrips: number;
};

/**
 * Standard Visitor visa 4 ระยะ — ตัวที่ยาวกว่า 6 เดือนคือ "long-term visit"
 * เข้าออกได้ไม่จำกัดครั้งตลอดอายุวีซ่า แต่แต่ละครั้งอยู่ได้ไม่เกิน 6 เดือน
 */
export const VISA_TYPES: VisaType[] = [
  {
    id: "visit6m",
    name: "Standard Visitor · 6 เดือน",
    feeGbp: 127,
    maxStayDays: 180,
    tagline: "ไปดูบอลทริปเดียว",
    bestFor: "ไปครั้งเดียวจบ ไม่มีแผนกลับไปอีกใน 2 ปี",
    breakEvenTrips: 1,
  },
  {
    id: "visit2y",
    name: "Long-term Visitor · 2 ปี",
    feeGbp: 475,
    maxStayDays: 180,
    tagline: "ตามทีมได้ 2 ฤดูกาล",
    bestFor: "ตั้งใจกลับไปดูอีกอย่างน้อยปีละครั้ง",
    breakEvenTrips: 4,
  },
  {
    id: "visit5y",
    name: "Long-term Visitor · 5 ปี",
    feeGbp: 848,
    maxStayDays: 180,
    tagline: "ครอบ 5 ฤดูกาลรวด",
    bestFor: "แฟนพันธุ์แท้ที่ไปเกือบทุกปี หรือมีธุระที่อังกฤษประจำ",
    breakEvenTrips: 7,
  },
  {
    id: "visit10y",
    name: "Long-term Visitor · 10 ปี",
    feeGbp: 1_059,
    maxStayDays: 180,
    tagline: "ยื่นครั้งเดียวจบ 10 ปี",
    bestFor: "ไม่อยากยื่นเอกสารซ้ำอีก และประวัติการเดินทางแข็งแรงแล้ว",
    breakEvenTrips: 9,
  },
];

// ── การยื่นแบบพิเศษ (lodge) ──────────────────────────────────────────────
// สองตัวแรกเป็นบริการเร่งของ Home Office (จ่ายเป็นปอนด์)
// ที่เหลือเป็นบริการเสริมของ VFS Global ศูนย์กรุงเทพฯ (จ่ายเป็นบาทหน้าเคาน์เตอร์)

export type LodgeOption = {
  id: string;
  name: string;
  /** ราคาต่อคน (บาท) — ตัวที่คิดเป็นปอนด์ใช้ feeGbp แทน แล้วแปลงด้วยเรตจริงตอนรัน */
  priceThb?: number;
  feeGbp?: number;
  perGroup?: boolean;
  /** ลดเวลารอผลเหลือกี่วันทำการ — 0 = ไม่เกี่ยวกับความเร็ว */
  decisionWorkingDays: number;
  detail: string;
  provider: "Home Office" | "VFS Global";
};

export const LODGE_OPTIONS: LodgeOption[] = [
  {
    id: "priority",
    name: "Priority — รู้ผลใน 5 วันทำการ",
    feeGbp: 500,
    decisionWorkingDays: 5,
    detail: "แฟ้มถูกดันขึ้นหัวคิวพิจารณา · ซื้อตอนกรอกใบสมัครออนไลน์เท่านั้น ซื้อย้อนหลังไม่ได้",
    provider: "Home Office",
  },
  {
    id: "super",
    name: "Super Priority — รู้ผลวันทำการถัดไป",
    feeGbp: 1_000,
    decisionWorkingDays: 1,
    detail: "ยื่น biometrics เช้า รู้ผลสิ้นวันทำการถัดไป · โควตาต่อวันจำกัด ช่วงปิดเทอมอังกฤษเต็มเร็ว",
    provider: "Home Office",
  },
  {
    id: "primetime",
    name: "Prime Time — ยื่นนอกเวลาทำการ",
    priceThb: 4_300,
    decisionWorkingDays: 0,
    detail: "จองคิวช่วงเย็นหรือเสาร์ที่ศูนย์ VFS — ไม่ต้องลางาน",
    provider: "VFS Global",
  },
  {
    id: "ondemand",
    name: "On-Demand — ทีม VFS มาเก็บ biometrics ถึงที่",
    priceThb: 26_000,
    perGroup: true,
    decisionWorkingDays: 0,
    detail: "เหมาะกับกรุ๊ปตั้งแต่ 4 คนขึ้นไปหรือผู้สูงอายุ · ราคาเหมาต่อครั้ง หารกันได้ทั้งกลุ่ม",
    provider: "VFS Global",
  },
  {
    id: "keeppassport",
    name: "ถือพาสปอร์ตไว้เองระหว่างรอผล",
    priceThb: 2_000,
    decisionWorkingDays: 0,
    detail: "จำเป็นถ้าต้องบินไปประเทศอื่นระหว่างรอวีซ่าอังกฤษ",
    provider: "VFS Global",
  },
  {
    id: "courier",
    name: "ส่งพาสปอร์ตคืนถึงบ้าน",
    priceThb: 700,
    decisionWorkingDays: 0,
    detail: "ไม่ต้องกลับไปรับเองที่ศูนย์ — ต่างจังหวัดคุ้มมาก",
    provider: "VFS Global",
  },
];

// ── แพ็กเกจบริการของเราเอง ────────────────────────────────────────────────

export type GogVisaPackage = {
  id: string;
  name: string;
  priceThb: number;
  tagline: string;
  includes: string[];
  /** ราคาต่อคนลดลงกี่ % เมื่อไปกันเป็นกลุ่ม (ตั้งแต่ 4 คน) */
  groupDiscount: number;
};

export const GOG_VISA_PACKAGES: GogVisaPackage[] = [
  {
    id: "guide",
    name: "GOG VISA UK · Guide",
    priceThb: 2_900,
    tagline: "ทำเองได้ แค่อยากมีคนตรวจให้",
    includes: [
      "เช็กลิสต์เอกสารเฉพาะเคสของคุณ (มนุษย์เงินเดือน/เจ้าของกิจการ/นักเรียน/ผู้สูงอายุ)",
      "ตรวจแฟ้มเอกสารก่อนยื่น 1 รอบ พร้อมชี้จุดที่มักโดนปฏิเสธ",
      "กรอกใบสมัครออนไลน์ให้ + จองคิว VFS ให้",
      "แนบแผนเที่ยวรายวัน ตั๋วบอล และที่พักจากทริปนี้เป็นเอกสารประกอบอัตโนมัติ",
    ],
    groupDiscount: 10,
  },
  {
    id: "full",
    name: "GOG VISA UK · Full Service",
    priceThb: 6_900,
    tagline: "ยกแฟ้มให้เราทำทั้งชุด",
    includes: [
      "ทุกอย่างของแพ็กเกจ Guide",
      "เรียบเรียงแฟ้มเอกสารตามลำดับที่เจ้าหน้าที่อ่านง่าย + แปลเอกสารไทยเป็นอังกฤษ",
      "เขียน cover letter อธิบายวัตถุประสงค์การเดินทางและความผูกพันกับประเทศไทย",
      "พาไปยื่นที่ศูนย์ VFS สุขุมวิท มีเจ้าหน้าที่อยู่ด้วยตลอดคิว",
      "ติดตามสถานะและแจ้งผลทาง LINE",
    ],
    groupDiscount: 15,
  },
  {
    id: "matchday",
    name: "GOG VISA UK · Matchday Guarantee",
    priceThb: 12_900,
    tagline: "ทริปผูกกับวันแข่ง พลาดไม่ได้",
    includes: [
      "ทุกอย่างของแพ็กเกจ Full Service",
      "จัดคิว Priority / Super Priority ให้ตรงกับวันแข่งที่เลือกไว้",
      "ยืนยันตั๋วเข้าสนามและที่พักเป็นเอกสารแนบตัวจริง",
      "ถ้าผลไม่ผ่าน ยื่นใหม่ให้ฟรี 1 รอบ (ค่าธรรมเนียมรัฐผู้เดินทางออกเอง)",
      "ถ้าวีซ่าไม่ทันวันแข่ง ช่วยเลื่อนแผนทริปและประสานพาร์ตเนอร์ให้ทั้งชุด",
    ],
    groupDiscount: 20,
  },
];

/** ราคาต่อคนหลังส่วนลดกลุ่ม — กลุ่มเริ่มนับที่ 4 คน */
export function packagePricePerPerson(pack: GogVisaPackage, travellers: number) {
  if (travellers < 4) return pack.priceThb;
  return Math.round((pack.priceThb * (100 - pack.groupDiscount)) / 100);
}

/** ราคาบริการ lodge เป็นบาท — ตัวที่ตั้งราคาเป็นปอนด์แปลงด้วยเรตจริงตอนเรียก */
export function lodgePriceThb(option: LodgeOption, rate = GBP_TO_THB) {
  return option.feeGbp ? Math.round(option.feeGbp * rate) : option.priceThb ?? 0;
}

// ── ยื่นที่ไหนได้บ้าง ─────────────────────────────────────────────────────

export type VisaCentre = {
  id: string;
  city: string;
  name: string;
  building: string;
  floor: string;
  address: string;
  /** การเดินทางที่ใช้ได้จริง เช่น สถานีรถไฟฟ้าที่ใกล้ที่สุด */
  getThere: string;
  hours: string;
  mapUrl: string;
  note?: string;
};

export const VISA_CENTRES: VisaCentre[] = [
  {
    id: "bangkok",
    city: "กรุงเทพฯ",
    name: "UK Visa Application Centre · Bangkok",
    building: "The Shoppes at Belle Grand Rama 9",
    floor: "ชั้น 1 · ยูนิต BS003 และ BS003/1",
    address: "131/1, 141/1 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310",
    getThere: "MRT พระราม 9 ทางออก 3 เดินเข้าโครงการ Belle Grand ประมาณ 5 นาที",
    hours: "จันทร์–ศุกร์ · ยื่นเอกสารช่วงเช้า รับเล่มคืนช่วงบ่าย (จองคิวออนไลน์ล่วงหน้าเท่านั้น)",
    mapUrl: "https://maps.google.com/?q=Belle+Grand+Rama+9+VFS+UK+Visa+Application+Centre",
    note: "ศูนย์หลัก รับทุกประเภทวีซ่า · ย้ายมาจากตึก The Trendy สุขุมวิท 13 แล้ว อย่าไปผิดที่",
  },
  {
    id: "chiangmai",
    city: "เชียงใหม่",
    name: "UK Visa Application Centre · Chiang Mai",
    building: "อาคารศิริพานิช (Siripanich Building)",
    floor: "ชั้น 6",
    address: "191 ถนนห้วยแก้ว ต.สุเทพ อ.เมือง เชียงใหม่ 50200",
    getThere: "ฝั่งถนนห้วยแก้ว ใกล้ห้างกาดสวนแก้ว",
    hours: "เปิดจำกัดวัน (ปกติจันทร์และพุธ ช่วงเช้า) — ต้องเช็กวันเปิดตอนจองคิวทุกครั้ง",
    mapUrl: "https://maps.google.com/?q=Siripanich+Building+Huay+Kaew+Road+Chiang+Mai",
    note: "คิวน้อยกว่ากรุงเทพฯ มาก ถ้าอยู่ภาคเหนือประหยัดค่าเดินทางได้เยอะ แต่ต้องจองล่วงหน้านานกว่า",
  },
];

// ── พาสปอร์ตไทย ───────────────────────────────────────────────────────────

export type PassportOption = {
  id: string;
  name: string;
  priceThb: number;
  validYears: 5 | 10;
  turnaround: string;
  note?: string;
};

/**
 * ค่าธรรมเนียมกรมการกงสุล — เล่มปกติกับเล่มด่วนพิเศษ (รับวันเดียว)
 * ยื่นด่วนพิเศษต้องยื่นก่อน 11:00 น. และรับเล่มบ่ายวันเดียวกัน
 */
export const PASSPORT_OPTIONS: PassportOption[] = [
  { id: "p5", name: "อายุ 5 ปี · เล่มปกติ", priceThb: 1_000, validYears: 5, turnaround: "รับเล่มใน 3–5 วันทำการ (ส่งไปรษณีย์ +40฿)" },
  { id: "p10", name: "อายุ 10 ปี · เล่มปกติ", priceThb: 1_500, validYears: 10, turnaround: "รับเล่มใน 3–5 วันทำการ (ส่งไปรษณีย์ +40฿)", note: "คุ้มกว่าถ้ายังเดินทางอีกหลายปี — เฉลี่ยปีละ 150฿" },
  { id: "p5e", name: "อายุ 5 ปี · ด่วนพิเศษ", priceThb: 3_000, validYears: 5, turnaround: "รับเล่มวันเดียวกัน (ยื่นก่อน 11:00 น.)" },
  { id: "p10e", name: "อายุ 10 ปี · ด่วนพิเศษ", priceThb: 3_500, validYears: 10, turnaround: "รับเล่มวันเดียวกัน (ยื่นก่อน 11:00 น.)", note: "ทางออกเมื่อเหลือเวลาน้อยจนจะยื่นวีซ่าไม่ทัน" },
];

export const PASSPORT_DOCUMENTS: DocumentItem[] = [
  { label: "บัตรประชาชนตัวจริง", detail: "ต้องยังไม่หมดอายุ · ชื่อ-นามสกุลต้องตรงกับที่จะใช้ยื่นวีซ่า" },
  { label: "เล่มเดิม (ถ้ามี)", detail: "เอาไปด้วยทุกครั้ง แม้หมดอายุแล้ว — ใช้ยืนยันประวัติการเดินทางตอนขอวีซ่าอังกฤษ" },
  { label: "ใบเปลี่ยนชื่อ-นามสกุล", detail: "เฉพาะคนที่เคยเปลี่ยน ต้องเอาตัวจริงไป" },
  { label: "ผู้เยาว์ต่ำกว่า 20 ปี", detail: "สูติบัตร + บิดามารดาไปลงนามต่อหน้าเจ้าหน้าที่ทั้งสองคน (ถ้าไปคนเดียวต้องมีหนังสือยินยอมจากอำเภอ)" },
  { label: "ไม่ต้องใช้รูปถ่าย", detail: "เจ้าหน้าที่ถ่ายรูปและเก็บลายนิ้วมือให้ที่สำนักงาน ไม่ต้องเตรียมไปเอง" },
];

export const PASSPORT_WHERE = "สำนักงานหนังสือเดินทางทั่วประเทศ — กรุงเทพฯ มีที่บางนา ปิ่นเกล้า MRT คลองเตย ธัญบุรี มีนบุรี และสาขาในห้าง จองคิวล่วงหน้าที่ passport.in.th หรือแอป Thai Passport";

// ── ใบขับขี่สากล ──────────────────────────────────────────────────────────

export type IdpOption = {
  id: string;
  name: string;
  priceThb: number;
  detail: string;
};

/**
 * อังกฤษใช้อนุสัญญาเจนีวา 1949 — ใบขับขี่สากลแบบ 1 ปี ใช้ได้
 * ค่าธรรมเนียม 505 บาทเป็นราคากรมการขนส่งทางบก (คำขอ 5 + ใบอนุญาต 500)
 */
export const IDP_OPTIONS: IdpOption[] = [
  {
    id: "idp1949",
    name: "ใบขับขี่สากล · อนุสัญญาเจนีวา 1949",
    priceThb: 505,
    detail: "ตัวที่ใช้ในอังกฤษ อายุ 1 ปี ขับได้ทันทีที่ถึง — ต้องพกคู่กับใบขับขี่ไทยตัวจริงเสมอ",
  },
];

export const IDP_DOCUMENTS: DocumentItem[] = [
  { label: "ใบขับขี่ไทยชนิด 5 ปี ตัวจริง", detail: "ใบชั่วคราว 2 ปีขอไม่ได้ ต้องอัปเป็น 5 ปีก่อน" },
  { label: "พาสปอร์ตตัวจริง + สำเนาหน้าแรก", detail: "ชื่อบนใบขับขี่สากลจะสะกดตามพาสปอร์ต ต้องเอาไปให้ตรง", fromTrip: false },
  { label: "บัตรประชาชนตัวจริง", detail: "ต่างชาติใช้ใบสำคัญถิ่นที่อยู่หรือใบอนุญาตทำงานแทน" },
  { label: "รูปถ่าย 2 นิ้ว 2 รูป", detail: "พื้นหลังขาว ถ่ายไม่เกิน 6 เดือน ไม่สวมแว่นดำ ไม่สวมหมวก" },
];

export const IDP_WHERE = "สำนักงานขนส่งทั่วประเทศ (กรุงเทพฯ ที่จตุจักร บางขุนเทียน ตลิ่งชัน หนองจอก) ยื่นแล้วรับเล่มวันเดียว · จองคิวที่แอป DLT Smart Queue";

export const IDP_ADVICE = "อังกฤษขับรถเลนซ้ายเหมือนไทย ถ้าไปแค่แมนเชสเตอร์กับลอนดอนใช้รถไฟกับรถราง สะดวกกว่าและไม่ต้องเจอค่าจอด ค่าธรรมเนียม Congestion Charge ในลอนดอน และ Clean Air Zone — เช่ารถคุ้มเมื่อจะขับออกไปสนามต่างเมืองหรือเที่ยวชนบท";

// ── eVisa (เปลี่ยนตั้งแต่ 25 ก.พ. 2026) ───────────────────────────────────

export const EVISA_NOTE = "ตั้งแต่ 25 กุมภาพันธ์ 2026 วีซ่าท่องเที่ยวอังกฤษเป็น eVisa เต็มรูปแบบ — ไม่มีสติกเกอร์วีซ่า (vignette) แปะในพาสปอร์ตอีกแล้ว สถานะอยู่ในระบบออนไลน์ทั้งหมด";

export const EVISA_STEPS = [
  { title: "สร้างบัญชี UKVI", detail: "ที่ gov.uk/get-access-evisa — ฟรี ไม่มีค่าใช้จ่าย ใช้อีเมลและเบอร์โทรที่เข้าถึงได้จริงตอนเดินทาง" },
  { title: "ยืนยันตัวตนด้วยแอป UK Immigration: ID Check", detail: "สแกนหน้าพาสปอร์ตและถ่ายใบหน้า — ผูกเล่มพาสปอร์ตเข้ากับบัญชี" },
  { title: "ผูกพาสปอร์ตเล่มที่จะใช้เดินทาง", detail: "ถ้าเปลี่ยนเล่มใหม่ทีหลัง ต้องเข้าไปอัปเดตเลขพาสปอร์ตในบัญชีก่อนบิน ไม่งั้นสายการบินเช็กสถานะไม่เจอ" },
  { title: "ออก share code เมื่อต้องใช้", detail: "จากเมนู View and Prove — โค้ดมีอายุ 90 วัน ออกใหม่ได้ไม่จำกัด ใช้ตอนสายการบินหรือ ตม. ขอตรวจ" },
  { title: "ก่อนบิน", detail: "สายการบินเช็กสิทธิ์เดินทางจากระบบดิจิทัลอัตโนมัติ · แคปหน้าจอสถานะและ share code เก็บไว้เผื่อเน็ตล่ม" },
];

export const VISA_LINKS = [
  { label: "กรอกใบสมัครวีซ่าท่องเที่ยว (Standard Visitor)", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa" },
  { label: "รายละเอียดวีซ่าท่องเที่ยว + เอกสารที่ต้องใช้", url: "https://www.gov.uk/standard-visitor" },
  { label: "สร้างบัญชี UKVI เพื่อเข้าถึง eVisa", url: "https://www.gov.uk/get-access-evisa" },
  { label: "ออก share code พิสูจน์สถานะ (View and Prove)", url: "https://www.gov.uk/view-prove-immigration-status" },
  { label: "จองคิวและดูบริการเสริมของ VFS ประเทศไทย", url: "https://visa.vfsglobal.com/tha/en/gbr" },
  { label: "ตรวจค่าธรรมเนียมวีซ่าล่าสุดทุกประเภท", url: "https://www.gov.uk/government/publications/visa-regulations-revised-table" },
  { label: "จองคิวทำพาสปอร์ตไทย", url: "https://www.passport.in.th/" },
  { label: "จองคิวทำใบขับขี่สากล (DLT Smart Queue)", url: "https://gecc.dlt.go.th/checkQueue/" },
];

// ── เอกสารที่ต้องเตรียม ───────────────────────────────────────────────────

export type DocumentItem = {
  label: string;
  detail: string;
  /** ทริปนี้ออกเอกสารให้ได้เลย ไม่ต้องไปหาที่อื่น */
  fromTrip?: boolean;
};

export type DocumentGroup = {
  id: string;
  title: string;
  note?: string;
  items: DocumentItem[];
};

export const VISA_DOCUMENTS: DocumentGroup[] = [
  {
    id: "identity",
    title: "ตัวตน",
    items: [
      { label: "พาสปอร์ตตัวจริง", detail: "อายุเหลืออย่างน้อย 6 เดือน และมีหน้าว่างอย่างน้อย 1 หน้าเต็ม" },
      { label: "พาสปอร์ตเล่มเก่าทุกเล่ม", detail: "ประวัติการเดินทางเก่าช่วยมาก โดยเฉพาะเชงเก้น ญี่ปุ่น เกาหลี ออสเตรเลีย" },
      { label: "รูปถ่ายดิจิทัล", detail: "พื้นหลังขาว ถ่ายไม่เกิน 6 เดือน — ถ่ายที่ศูนย์ VFS ได้เลยตอนไปยื่น" },
      { label: "ทะเบียนบ้าน + บัตรประชาชน", detail: "แปลเป็นอังกฤษ ไม่ต้องรับรองกงสุลก็ได้" },
    ],
  },
  {
    id: "money",
    title: "การเงิน",
    note: "จุดที่คนไทยโดนปฏิเสธมากที่สุด — เงินต้องอยู่ในบัญชีอย่างสม่ำเสมอ ไม่ใช่โอนก้อนเข้ามาก่อนยื่น",
    items: [
      { label: "Statement ย้อนหลัง 6 เดือน", detail: "ตัวจริงจากธนาคาร มีตราประทับ · ยอดคงเหลือควรพอกับค่าทริปทั้งก้อน + สำรองอีกราว 30%" },
      { label: "สลิปเงินเดือน 3 เดือนล่าสุด", detail: "ถ้าเป็นเจ้าของกิจการใช้หนังสือรับรองบริษัท + งบการเงินแทน" },
      { label: "หนังสือรับรองการทำงาน", detail: "ระบุตำแหน่ง เงินเดือน อายุงาน และวันลาที่อนุมัติแล้ว — ออกไม่เกิน 1 เดือนก่อนยื่น" },
      { label: "หลักฐานสินทรัพย์ (ถ้ามี)", detail: "โฉนดที่ดิน ทะเบียนรถ กองทุน — ใช้ยืนยันว่าจะกลับไทยแน่นอน" },
    ],
  },
  {
    id: "trip",
    title: "แผนการเดินทาง",
    note: "ชุดนี้ทริปนี้ออกให้ได้เลย กด \"บันทึก + คัดลอกลิงก์แชร์\" แล้วสั่งพิมพ์เป็น PDF แนบไปได้",
    items: [
      { label: "แผนเที่ยวรายวันทั้งทริป", detail: "ระบุว่าแต่ละวันอยู่ที่ไหน ทำอะไร — เจ้าหน้าที่ดูว่าแผนสมเหตุสมผลกับจำนวนวันไหม", fromTrip: true },
      { label: "ตารางบินไป-กลับ", detail: "จองไว้ก่อนได้ ยังไม่ต้องออกตั๋ว (ห้ามซื้อตั๋วจริงก่อนวีซ่าออก)", fromTrip: true },
      { label: "ใบยืนยันที่พักทุกคืน", detail: "จองแบบยกเลิกฟรีไว้ก่อน ครอบให้ครบทุกคืนไม่ให้มีวันโหว่", fromTrip: true },
      { label: "หลักฐานตั๋วเข้าสนาม", detail: "อีเมลยืนยันจากสโมสรหรือผู้ขายที่ถูกกฎหมาย — เป็นเหตุผลการเดินทางที่หนักแน่นมาก", fromTrip: true },
      { label: "ประกันการเดินทาง", detail: "ไม่บังคับสำหรับวีซ่าท่องเที่ยว แต่ช่วยให้แฟ้มดูรัดกุมขึ้น" },
    ],
  },
  {
    id: "ties",
    title: "ความผูกพันกับประเทศไทย",
    note: "หัวใจของวีซ่าท่องเที่ยวคือพิสูจน์ว่า \"มีเหตุผลต้องกลับ\"",
    items: [
      { label: "ใบลาที่อนุมัติแล้ว", detail: "ระบุวันกลับเข้าทำงานชัดเจน ให้ตรงกับวันบินกลับในแผน" },
      { label: "สัญญาจ้าง / ทะเบียนพาณิชย์", detail: "เจ้าของกิจการแนบ บอจ.5 และภาพถ่ายกิจการเพิ่มได้" },
      { label: "หลักฐานครอบครัวในไทย", detail: "ทะเบียนสมรส สูติบัตรลูก หรือหลักฐานว่าดูแลพ่อแม่" },
    ],
  },
  {
    id: "special",
    title: "เคสพิเศษ",
    items: [
      { label: "ผู้เดินทางอายุต่ำกว่า 18 ปี", detail: "สูติบัตร + หนังสือยินยอมจากผู้ปกครองทั้งสองคน + สำเนาบัตรผู้ปกครอง" },
      { label: "มีผู้ออกค่าใช้จ่ายให้", detail: "จดหมายรับรองการสนับสนุน + statement 6 เดือนของผู้สนับสนุน + หลักฐานความสัมพันธ์" },
      { label: "เคยถูกปฏิเสธวีซ่ามาก่อน", detail: "ต้องแจ้งในใบสมัครเสมอ และเขียนอธิบายว่าแก้ไขจุดที่เป็นเหตุผลเดิมอย่างไร — ปกปิดคือเหตุให้แบน 10 ปี" },
      { label: "เปลี่ยนชื่อ-นามสกุล", detail: "ใบเปลี่ยนชื่อพร้อมคำแปล ให้ชื่อในทุกเอกสารตรงกัน" },
    ],
  },
];

// ── ไทม์ไลน์ ──────────────────────────────────────────────────────────────

export const VISA_STEPS = [
  { title: "สร้างบัญชี UKVI ก่อน", detail: "ตอนนี้เป็น eVisa แล้ว ไม่มีสติกเกอร์แปะเล่ม — สมัครบัญชีที่ gov.uk/get-access-evisa ให้เรียบร้อยก่อนเริ่มกรอก" },
  { title: "กรอกใบสมัครออนไลน์", detail: "ที่ gov.uk เลือก Standard Visitor · จ่ายค่าธรรมเนียมด้วยบัตรเครดิต และเลือกซื้อ Priority / Super Priority ตรงนี้เท่านั้น ซื้อย้อนหลังไม่ได้" },
  { title: "จองคิวและยื่น biometrics", detail: "ศูนย์ VFS Global — กรุงเทพฯ ที่ Belle Grand Rama 9 ชั้น 1 หรือเชียงใหม่ที่อาคารศิริพานิช ชั้น 6 · เก็บลายนิ้วมือและถ่ายรูป" },
  { title: "อัปโหลดหรือยื่นเอกสารประกอบ", detail: "อัปโหลดเองล่วงหน้าได้ หรือให้ VFS สแกนให้หน้าเคาน์เตอร์ (มีค่าบริการเพิ่ม)" },
  { title: "รอผล", detail: "มาตรฐานราว 15 วันทำการ · ซื้อ Priority เหลือ 5 วันทำการ · Super Priority วันทำการถัดไป" },
  { title: "ผูก eVisa แล้วค่อยออกตั๋วจริง", detail: "ผลออกทางอีเมล เข้าบัญชี UKVI ตรวจสถานะและออก share code — ค่อยจ่ายตั๋วเครื่องบินจริงหลังเห็นสถานะอนุมัติแล้วเท่านั้น" },
];

/** วันทำการที่ต้องรอตามบริการที่เลือก — ไม่ซื้อบริการเร่งคือมาตรฐาน 15 วันทำการ */
export function decisionWorkingDays(lodgeIds: string[]) {
  const speedy = LODGE_OPTIONS
    .filter((option) => lodgeIds.includes(option.id) && option.decisionWorkingDays > 0)
    .map((option) => option.decisionWorkingDays);
  return speedy.length ? Math.min(...speedy) : 15;
}

export type VisaTiming = {
  workingDays: number;
  /** ควรยื่นภายในวันนี้ (YYYY-MM-DD) — เผื่อกันเหนียวไว้แล้ว 7 วัน */
  lodgeBy: string;
  /** ยื่นได้เร็วสุดวันนี้ — กติกาคือไม่เกิน 3 เดือนก่อนเดินทาง */
  earliest: string;
};

function shiftDays(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * คำนวณเส้นตายการยื่นจากวันบิน
 * วันทำการ → วันปฏิทินคูณ 7/5 แล้วบวกกันเหนียวอีก 7 วัน เผื่อคิวศูนย์เต็มหรือโดนขอเอกสารเพิ่ม
 */
export function visaTiming(departDate: string, lodgeIds: string[]): VisaTiming | null {
  if (!departDate) return null;
  const workingDays = decisionWorkingDays(lodgeIds);
  const calendarDays = Math.ceil((workingDays * 7) / 5) + 7;
  return {
    workingDays,
    lodgeBy: shiftDays(departDate, -calendarDays),
    earliest: shiftDays(departDate, -90),
  };
}

// ── แผนลงวันจริง ว่าต้องทำอะไรวันไหน ──────────────────────────────────────

export type PlanMilestone = {
  id: string;
  /** วันที่ควรลงมือ (YYYY-MM-DD) */
  date: string;
  title: string;
  detail: string;
  /** true = พลาดวันนี้แล้วทริปมีสิทธิ์ล่ม ไม่ใช่แค่ช้า */
  critical?: boolean;
};

export type VisaPlanInput = {
  departDate: string;
  returnDate: string;
  lodgeIds: string[];
  /** ยังไม่มีพาสปอร์ต หรือเล่มใกล้หมดอายุ — ต้องเผื่อเวลาทำเล่มก่อนยื่นวีซ่า */
  needPassport: boolean;
  /** จะทำใบขับขี่สากลไปด้วย */
  needIdp: boolean;
  /** วันนี้ (YYYY-MM-DD) — ส่งเข้ามาเพื่อให้ฟังก์ชันบริสุทธิ์และเทสต์ได้ */
  today: string;
};

export type VisaPlan = {
  milestones: PlanMilestone[];
  /** วันที่ควรยื่นจริง — คำนวณแล้วว่าอยู่ก่อนวันบินและทันรอผลแน่นอน */
  lodgeBy: string;
  /** วันที่คาดว่าจะรู้ผล */
  decisionBy: string;
  /** วันที่ควรจ่ายตั๋วเครื่องบิน + ยืนยันโรงแรมจริง */
  bookingBy: string;
  /** ยื่นได้เร็วสุดตามกติกา 3 เดือน */
  earliest: string;
  workingDays: number;
  /** ยังยื่นทันไหมถ้าเริ่มวันนี้ */
  feasible: boolean;
  /** ถ้าไม่ทัน ต้องเลื่อนวันบินออกไปอีกกี่วัน */
  shortfallDays: number;
};

function laterOf(a: string, b: string) {
  return a >= b ? a : b;
}

function earlierOf(a: string, b: string) {
  return a <= b ? a : b;
}

function diffDays(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * หาวันยื่นที่เหมาะที่สุด โดยยึดหลักว่าทุกก้าวต้องจบก่อนวันบิน
 *
 * decisionCalendar = วันทำการ × 7/5 (วันทำการ → วันปฏิทิน)
 * ยื่นในอุดมคติ    = วันบิน − (เวลารอผล + กันเหนียว 7 วัน + เวลาจองตั๋ว 3 วัน)
 * เพดานล่าง        = วันบิน − 90 (ยื่นล่วงหน้าเกิน 3 เดือนไม่ได้)
 * เพดานบน          = วันบิน − (เวลารอผล + 3) เพื่อให้เหลือเวลาออกตั๋วหลังผลออก
 * แล้วดันให้ไม่เร็วกว่าวันนี้ — ถ้าเพดานบนอยู่ก่อนวันนี้แปลว่ายื่นไม่ทันแล้ว
 */
function solveVisaDates(departDate: string, lodgeIds: string[], today: string) {
  const workingDays = decisionWorkingDays(lodgeIds);
  const decisionCalendar = Math.ceil((workingDays * 7) / 5);
  const earliest = shiftDays(departDate, -90);
  // ต้องรู้ผลก่อนบินอย่างน้อย 3 วัน ไม่งั้นออกตั๋วไม่ทัน
  const latestLodge = shiftDays(departDate, -(decisionCalendar + 3));
  const idealLodge = shiftDays(departDate, -(decisionCalendar + 7 + 3));

  const feasible = latestLodge >= today;
  // ยื่นเร็วสุดที่ทำได้จริง = ไม่ก่อนวันนี้ และไม่ก่อนเพดาน 3 เดือน
  const floor = laterOf(today, earliest);
  const lodgeBy = feasible ? laterOf(earlierOf(idealLodge, latestLodge), floor) : today;
  const decisionBy = shiftDays(lodgeBy, decisionCalendar);
  const bookingBy = shiftDays(decisionBy, 2);

  return {
    workingDays,
    decisionCalendar,
    earliest,
    lodgeBy,
    decisionBy,
    bookingBy,
    feasible,
    shortfallDays: feasible ? 0 : diffDays(latestLodge, today),
  };
}

/**
 * แปลงวันบินเป็นตารางลงมือจริง โดยไล่ถอยหลังจากวันเดินทาง
 * ทุกก้าวอิงกติกาจริง: ยื่นวีซ่าล่วงหน้าได้ไม่เกิน 3 เดือน · ต้องมีพาสปอร์ตก่อนยื่นวีซ่า
 * · ห้ามออกตั๋วจริงก่อนวีซ่าออก · ตั๋วบอลของสโมสรเปิดขายก่อนเกมประมาณ 1 เดือน
 */
export function buildVisaPlan(input: VisaPlanInput): VisaPlan | null {
  const { departDate, returnDate, lodgeIds, needPassport, needIdp, today } = input;
  if (!departDate) return null;

  const solved = solveVisaDates(departDate, lodgeIds, today);
  const { lodgeBy, decisionBy, bookingBy, earliest, workingDays } = solved;
  const milestones: PlanMilestone[] = [];

  // ── ก่อนยื่น ──────────────────────────────────────────────────────────
  if (needPassport) {
    // ต้องได้เล่มก่อนวันยื่น เผื่อคิวจองล่วงหน้า 14 วัน แต่ไม่ย้อนไปก่อนวันนี้
    milestones.push({
      id: "passport",
      date: laterOf(shiftDays(lodgeBy, -14), today),
      title: "ทำพาสปอร์ตให้เสร็จก่อน",
      detail: "ยื่นวีซ่าอังกฤษไม่ได้ถ้ายังไม่มีเล่ม · เล่มปกติรอ 3–5 วันทำการ แต่คิวจองล่วงหน้ามักเต็มเป็นสัปดาห์ ถ้าชนเวลาให้ใช้เล่มด่วนพิเศษรับวันเดียว",
      critical: true,
    });
  }

  milestones.push({
    id: "docs",
    date: laterOf(shiftDays(lodgeBy, -10), today),
    title: "รวบรวมเอกสารให้ครบ",
    detail: "statement ย้อนหลัง 6 เดือนกับหนังสือรับรองการทำงานต้องขอจากธนาคารและ HR ล่วงหน้า — ปกติใช้เวลา 3–7 วันทำการ",
  });

  milestones.push({
    id: "ukvi",
    date: laterOf(shiftDays(lodgeBy, -3), today),
    title: "สร้างบัญชี UKVI + จองคิว VFS",
    detail: "ตอนนี้เป็น eVisa แล้ว ต้องมีบัญชี UKVI ก่อน · จองคิวศูนย์ Belle Grand Rama 9 หรือเชียงใหม่ให้ได้วันที่ยื่นทัน",
  });

  // ── ยื่น → รู้ผล → ค่อยจ่ายเงินก้อนใหญ่ ───────────────────────────────
  milestones.push({
    id: "lodge",
    date: lodgeBy,
    title: "วันยื่นวีซ่า — กรอกออนไลน์ จ่ายค่าธรรมเนียม แล้วไปเก็บ biometrics",
    detail: `ก่อนวันบิน ${diffDays(lodgeBy, departDate)} วัน · ยื่นได้เร็วสุด ${thaiShort(earliest)} (กติกาห้ามยื่นล่วงหน้าเกิน 3 เดือน) · ซื้อบริการเร่งได้ตรงขั้นตอนนี้เท่านั้น`,
    critical: true,
  });

  milestones.push({
    id: "decision",
    date: decisionBy,
    title: `วันที่น่าจะรู้ผล — รอ ${workingDays} วันทำการ`,
    detail: `เหลือเวลาก่อนบินอีก ${diffDays(decisionBy, departDate)} วัน · ผลส่งทางอีเมลแล้วเข้าดู eVisa ในบัญชี UKVI — ถ้าไม่ผ่านยังพอมีเวลาแก้เอกสารยื่นใหม่`,
    critical: true,
  });

  milestones.push({
    id: "tickets",
    date: bookingBy,
    title: "วันจ่ายตั๋วเครื่องบินจริง + ยืนยันโรงแรม",
    detail: "ห้ามจ่ายตั๋วที่คืนเงินไม่ได้ก่อนวีซ่าออก — ตอนยื่นวีซ่าใช้แค่ใบจองที่ยังไม่ออกตั๋วก็พอ · จองโรงแรมแบบยกเลิกฟรีไว้ก่อนแล้วมายืนยันตอนนี้",
    critical: true,
  });

  if (needIdp) {
    milestones.push({
      id: "idp",
      date: earlierOf(shiftDays(bookingBy, 1), shiftDays(departDate, -7)),
      title: "ทำใบขับขี่สากล",
      detail: "ยื่นที่สำนักงานขนส่ง รับเล่มวันเดียว · ต้องมีพาสปอร์ตแล้วเพราะชื่อบนเล่มสะกดตามพาสปอร์ต",
    });
  }

  // ก่อนบิน 7 วัน แต่ต้องไม่ไปอยู่ก่อนวันจองตั๋ว
  milestones.push({
    id: "matchticket",
    date: laterOf(shiftDays(departDate, -7), shiftDays(bookingBy, 1)),
    title: "ยืนยันตั๋วเข้าสนาม + ออก share code",
    detail: "ออก share code จากเมนู View and Prove (อายุ 90 วัน) แคปเก็บไว้ · เช็กอีกรอบว่าเวลาเตะไม่ถูกเลื่อนเพราะถ่ายทอดสด",
  });

  milestones.push({
    id: "depart",
    date: departDate,
    title: "ออกเดินทางจากกรุงเทพฯ",
    detail: returnDate
      ? `กลับถึงกรุงเทพฯ ${thaiShort(returnDate)} · ตรวจว่าเลขพาสปอร์ตในบัญชี UKVI ตรงกับเล่มที่ถือไปจริง`
      : "ตรวจว่าเลขพาสปอร์ตในบัญชี UKVI ตรงกับเล่มที่ถือไปจริง",
    critical: true,
  });

  return {
    milestones: milestones.sort((a, b) => a.date.localeCompare(b.date)),
    lodgeBy,
    decisionBy,
    bookingBy,
    earliest,
    workingDays,
    feasible: solved.feasible,
    shortfallDays: solved.shortfallDays,
  };
}

function thaiShort(ymd: string) {
  return ymd.split("-").reverse().join("/");
}

// ── รวมเป็นบรรทัดค่าใช้จ่ายของทริป ────────────────────────────────────────

/** ตอบก่อนว่ามีพาสปอร์ตหรือยัง — ยังไม่ตอบ = ยังไม่ต้องเสนออะไรเรื่องเล่ม */
export type PassportStatus = "unknown" | "have" | "expiring" | "none";

export type VisaSelection = {
  typeId: VisaTypeId | null;
  lodgeIds: string[];
  packageId: string | null;
  passportStatus: PassportStatus;
  /** เลือกไว้เมื่อยังไม่มีพาสปอร์ตหรือเล่มใกล้หมดอายุ */
  passportId: string | null;
  /** จะทำใบขับขี่สากลไปด้วยหรือไม่ */
  idpId: string | null;
};

export const EMPTY_VISA: VisaSelection = {
  typeId: null,
  lodgeIds: [],
  packageId: null,
  passportStatus: "unknown",
  passportId: null,
  idpId: null,
};

/** ต้องทำเล่มก่อนถึงจะยื่นวีซ่าได้ไหม */
export function needsPassportWork(status: PassportStatus) {
  return status === "none" || status === "expiring";
}

// ── แยกให้เห็นว่าเงินก้อนไหนเป็นค่าอะไร ──────────────────────────────────
// ผู้ใช้ถามบ่อยว่า "จ่ายให้รัฐเท่าไหร่ จ่ายค่าบริการเท่าไหร่" — แยกตั้งแต่ต้นทาง
// government = ค่าธรรมเนียมราชการ ไม่ว่าจะใช้บริการใครก็ต้องจ่ายเท่านี้
// service    = ค่าดำเนินการที่เลือกจ่ายเพิ่มเอง (VFS / GOG) ตัดออกได้ถ้าทำเอง

export type CostGroup = "government" | "service";

export type VisaBreakdown = {
  /** ค่าธรรมเนียมวีซ่าอังกฤษที่จ่ายให้ Home Office */
  visaGovernment: number;
  /** ค่าบริการเร่ง/เสริมของ Home Office และ VFS */
  visaService: number;
  /** ค่าธรรมเนียมทำพาสปอร์ตไทย */
  passportGovernment: number;
  /** ค่าธรรมเนียมใบขับขี่สากล */
  idpGovernment: number;
  /** ค่าบริการ GOG VISA UK */
  gogService: number;
  government: number;
  service: number;
  total: number;
};

export function visaBreakdown(selection: VisaSelection, travellers: number, rate = GBP_TO_THB): VisaBreakdown {
  const pax = Math.max(travellers, 1);
  const type = VISA_TYPES.find((item) => item.id === selection.typeId);
  const visaGovernment = type ? Math.round(type.feeGbp * rate) : 0;

  let visaService = 0;
  for (const option of LODGE_OPTIONS) {
    if (!selection.lodgeIds.includes(option.id)) continue;
    const price = lodgePriceThb(option, rate);
    visaService += option.perGroup ? Math.round(price / pax) : price;
  }

  const passport = PASSPORT_OPTIONS.find((item) => item.id === selection.passportId);
  const passportGovernment = passport?.priceThb ?? 0;
  const idp = IDP_OPTIONS.find((item) => item.id === selection.idpId);
  const idpGovernment = idp?.priceThb ?? 0;

  const pack = GOG_VISA_PACKAGES.find((item) => item.id === selection.packageId);
  const gogService = pack ? packagePricePerPerson(pack, pax) : 0;

  const government = visaGovernment + passportGovernment + idpGovernment;
  const service = visaService + gogService;
  return {
    visaGovernment,
    visaService,
    passportGovernment,
    idpGovernment,
    gogService,
    government,
    service,
    total: government + service,
  };
}

/**
 * แปลงสิ่งที่เลือกไว้เป็น CostLine ต่อคน เพื่อให้ estimateTrip เอาไปบวกได้ตรง ๆ
 * ตัวที่คิดต่อกลุ่ม (เช่น On-Demand) หารด้วยจำนวนคนก่อน เพราะทั้งระบบคิดต่อคน
 */
export function visaCostLines(selection: VisaSelection, travellers: number, rate = GBP_TO_THB): CostLine[] {
  const lines: CostLine[] = [];
  const pax = Math.max(travellers, 1);

  const type = VISA_TYPES.find((item) => item.id === selection.typeId);
  if (type) {
    lines.push({
      key: "visa-fee",
      label: `วีซ่าอังกฤษ · ${type.name}`,
      amount: Math.round(type.feeGbp * rate),
      note: `ค่าธรรมเนียม £${type.feeGbp.toLocaleString("en-GB")} × ${rate} · จ่ายตอนกรอกใบสมัครออนไลน์ ไม่คืนเงินแม้ผลไม่ผ่าน`,
    });
  }

  for (const option of LODGE_OPTIONS) {
    if (!selection.lodgeIds.includes(option.id)) continue;
    const price = lodgePriceThb(option, rate);
    lines.push({
      key: `visa-lodge-${option.id}`,
      label: option.name,
      amount: option.perGroup ? Math.round(price / pax) : price,
      note: option.perGroup
        ? `ราคาเหมา ${option.provider} หารกัน ${pax} คน`
        : option.feeGbp ? `${option.provider} · £${option.feeGbp.toLocaleString("en-GB")}` : option.provider,
    });
  }

  const passport = PASSPORT_OPTIONS.find((item) => item.id === selection.passportId);
  if (passport) {
    lines.push({
      key: "visa-passport",
      label: `พาสปอร์ตไทย · ${passport.name}`,
      amount: passport.priceThb,
      note: passport.turnaround,
    });
  }

  const idp = IDP_OPTIONS.find((item) => item.id === selection.idpId);
  if (idp) {
    lines.push({ key: "visa-idp", label: idp.name, amount: idp.priceThb, note: "กรมการขนส่งทางบก · รับเล่มวันเดียว" });
  }

  const pack = GOG_VISA_PACKAGES.find((item) => item.id === selection.packageId);
  if (pack) {
    const price = packagePricePerPerson(pack, pax);
    lines.push({
      key: "visa-gog",
      label: pack.name,
      amount: price,
      note: price < pack.priceThb ? `ลดกลุ่ม ${pack.groupDiscount}% แล้ว (${pax} คน)` : "ค่าบริการ GOG",
    });
  }

  return lines;
}

export function hasVisa(selection: VisaSelection) {
  return Boolean(
    selection.typeId || selection.lodgeIds.length || selection.packageId || selection.passportId || selection.idpId,
  );
}
