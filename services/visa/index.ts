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
  /** ราคาต่อคน (บาท) — ตัวที่คิดต่อกลุ่มใช้ perGroup แทน */
  priceThb: number;
  perGroup?: boolean;
  /** ลดเวลารอผลเหลือกี่วันทำการ — 0 = ไม่เกี่ยวกับความเร็ว */
  decisionWorkingDays: number;
  detail: string;
  provider: "Home Office" | "VFS Global";
};

const gbp = (amount: number) => Math.round(amount * GBP_TO_THB);

export const LODGE_OPTIONS: LodgeOption[] = [
  {
    id: "priority",
    name: "Priority — รู้ผลใน 5 วันทำการ",
    priceThb: gbp(500),
    decisionWorkingDays: 5,
    detail: "แฟ้มถูกดันขึ้นหัวคิวพิจารณา · ซื้อตอนกรอกใบสมัครออนไลน์เท่านั้น ซื้อย้อนหลังไม่ได้",
    provider: "Home Office",
  },
  {
    id: "super",
    name: "Super Priority — รู้ผลวันทำการถัดไป",
    priceThb: gbp(1_000),
    decisionWorkingDays: 1,
    detail: "ยื่น biometrics เช้า รู้ผลสิ้นวันทำการถัดไป · โควตาต่อวันจำกัด ช่วงปิดเทอมอังกฤษเต็มเร็ว",
    provider: "Home Office",
  },
  {
    id: "primetime",
    name: "Prime Time — ยื่นนอกเวลาทำการ",
    priceThb: 4_300,
    decisionWorkingDays: 0,
    detail: "จองคิวช่วงเย็นหรือเสาร์ที่ศูนย์ VFS สุขุมวิท — ไม่ต้องลางาน",
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
  { title: "กรอกใบสมัครออนไลน์", detail: "ที่ gov.uk เลือก Standard Visitor · จ่ายค่าธรรมเนียมด้วยบัตรเครดิต และเลือกซื้อบริการเร่งตรงนี้" },
  { title: "จองคิวและยื่น biometrics", detail: "ศูนย์ VFS Global กรุงเทพฯ (อาคาร The Trendy สุขุมวิท 13) หรือเชียงใหม่ — เก็บลายนิ้วมือและถ่ายรูป" },
  { title: "อัปโหลดหรือยื่นเอกสารประกอบ", detail: "อัปโหลดเองล่วงหน้าได้ หรือให้ VFS สแกนให้หน้าเคาน์เตอร์ (มีค่าบริการ)" },
  { title: "รอผล", detail: "มาตรฐานราว 15 วันทำการ · ซื้อ Priority เหลือ 5 วันทำการ · Super Priority วันทำการถัดไป" },
  { title: "รับพาสปอร์ตคืน", detail: "รับเองที่ศูนย์ หรือให้ส่งถึงบ้าน — ค่อยออกตั๋วเครื่องบินจริงหลังวีซ่าออกแล้วเท่านั้น" },
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

// ── รวมเป็นบรรทัดค่าใช้จ่ายของทริป ────────────────────────────────────────

export type VisaSelection = {
  typeId: VisaTypeId | null;
  lodgeIds: string[];
  packageId: string | null;
};

export const EMPTY_VISA: VisaSelection = { typeId: null, lodgeIds: [], packageId: null };

/**
 * แปลงสิ่งที่เลือกไว้เป็น CostLine ต่อคน เพื่อให้ estimateTrip เอาไปบวกได้ตรง ๆ
 * ตัวที่คิดต่อกลุ่ม (เช่น On-Demand) หารด้วยจำนวนคนก่อน เพราะทั้งระบบคิดต่อคน
 */
export function visaCostLines(selection: VisaSelection, travellers: number): CostLine[] {
  const lines: CostLine[] = [];
  const pax = Math.max(travellers, 1);

  const type = VISA_TYPES.find((item) => item.id === selection.typeId);
  if (type) {
    lines.push({
      key: "visa-fee",
      label: `วีซ่าอังกฤษ · ${type.name}`,
      amount: Math.round(type.feeGbp * GBP_TO_THB),
      note: `ค่าธรรมเนียม £${type.feeGbp.toLocaleString("en-GB")} · จ่ายตอนกรอกใบสมัครออนไลน์ ไม่คืนเงินแม้ผลไม่ผ่าน`,
    });
  }

  for (const option of LODGE_OPTIONS) {
    if (!selection.lodgeIds.includes(option.id)) continue;
    lines.push({
      key: `visa-lodge-${option.id}`,
      label: option.name,
      amount: option.perGroup ? Math.round(option.priceThb / pax) : option.priceThb,
      note: option.perGroup ? `ราคาเหมา ${option.provider} หารกัน ${pax} คน` : option.provider,
    });
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
  return Boolean(selection.typeId || selection.lodgeIds.length || selection.packageId);
}
