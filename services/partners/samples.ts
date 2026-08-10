// การ์ดตัวอย่างของ GOG Partner Network (STEP 46)
// ---------------------------------------------------------------------------
// ใช้โชว์หน้าตาไดเรกทอรีตอนที่ยังไม่มีคนสมัครเข้ามาจริง — ทีมงานจะได้เห็นภาพ
// ว่าการ์ดแต่ละประเภทหน้าตาเป็นยังไง และเอาไปคุยกับผู้สมัครได้
//
// **ข้อมูลสมมติทั้งหมด ไม่ใช่ผู้ให้บริการจริง** — id ขึ้นต้น `sample_` เสมอ
// หน้าเว็บติดป้าย "ตัวอย่าง" ทุกใบ และไม่มีช่องทางติดต่อให้ กันคนเข้าใจผิดว่าจองได้
// พอมีพาร์ตเนอร์ตัวจริงผ่านการตรวจแล้ว ปิดสวิตช์ตรงหน้าเว็บได้เลย ไม่ต้องแก้โค้ด

import type { Partner, PartnerKind } from "@/lib/server/partners";

function sample(
  id: string,
  kind: PartnerKind,
  displayName: string,
  city: string,
  areas: string[],
  bio: string,
  services: Array<{ title: string; priceThb: number; pricingModel: string; capacity: number; matchdayReady: boolean; notes?: string }>,
  extra: Partial<Partner> = {},
): Partner {
  return {
    id: `sample_${id}`,
    kind,
    displayName,
    city,
    areas,
    languages: ["th", "en"],
    bio,
    status: "verified",
    rating: 4.8,
    reviewCount: 0,
    vehicle: null,
    services: services.map((service, index) => ({
      id: `svc_${index}`,
      title: service.title,
      pricingModel: service.pricingModel as Partner["services"][number]["pricingModel"],
      priceThb: service.priceThb,
      capacity: service.capacity,
      matchdayReady: service.matchdayReady,
      notes: service.notes ?? "",
    })),
    createdAt: "2026-08-01T00:00:00.000Z",
    ...extra,
  };
}

export const SAMPLE_PARTNERS: Partner[] = [
  sample(
    "driver_1", "driver", "ป้อม แมนเชสเตอร์ทรานสเฟอร์", "Manchester",
    ["City Centre", "Trafford", "MAN Airport"],
    "คนไทยขับรถในแมนเชสเตอร์มา 7 ปี รับส่งสนามบินและวันแข่ง รู้จุดจอดรอบโอลด์ แทรฟฟอร์ดที่ออกได้เร็วหลังเกม",
    [
      { title: "รับส่งสนามบิน MAN ↔ ที่พักในเมือง", priceThb: 2_400, pricingModel: "per_transfer", capacity: 7, matchdayReady: true },
      { title: "เหมาวันแข่ง ไป-กลับสนาม + รอ", priceThb: 6_800, pricingModel: "per_day", capacity: 7, matchdayReady: true },
    ],
    { rating: 4.9, reviewCount: 42, vehicle: { make: "Mercedes-Benz", model: "V-Class", year: 2023, seats: 7, luggage: 6 } },
  ),
  sample(
    "driver_2", "driver", "เจมส์ ลอนดอนไดรฟ์", "London",
    ["Central", "Heathrow", "Wembley"],
    "รับงานโซนลอนดอนและปริมณฑล ถนัดเส้นทางสนามบอลในลอนดอนทุกสนาม เข้าใจ Congestion Charge และ ULEZ",
    [
      { title: "รับส่งสนามบิน LHR ↔ ใจกลางลอนดอน", priceThb: 3_100, pricingModel: "per_transfer", capacity: 6, matchdayReady: true },
      { title: "เหมาวันเที่ยวในเมือง 8 ชั่วโมง", priceThb: 8_900, pricingModel: "per_day", capacity: 6, matchdayReady: false },
    ],
    { rating: 4.7, reviewCount: 28, vehicle: { make: "Volkswagen", model: "Caravelle", year: 2022, seats: 6, luggage: 5 } },
  ),
  sample(
    "photo_1", "photographer", "มิ้นท์ โฟโต้ แมนเชสเตอร์", "Manchester",
    ["Old Trafford", "Northern Quarter", "Salford"],
    "ถ่ายภาพหน้าสนามและในเมือง ส่งไฟล์รีทัชภายใน 48 ชั่วโมง มีชุดถ่ายวันแข่งที่ตามเก็บบรรยากาศก่อน-หลังเกม",
    [
      { title: "แพ็กเกจหน้าสนาม 1 ชั่วโมง (30 ไฟล์)", priceThb: 4_500, pricingModel: "per_hour", capacity: 6, matchdayReady: true },
      { title: "ตามเก็บทั้งวันแข่ง (150+ ไฟล์)", priceThb: 15_000, pricingModel: "per_day", capacity: 10, matchdayReady: true },
    ],
    { rating: 5, reviewCount: 19 },
  ),
  sample(
    "guide_1", "guide", "อาร์ต ไกด์สายบอล", "Manchester",
    ["Old Trafford", "Etihad", "City Centre"],
    "อดีตนักข่าวกีฬา พาเดินทัวร์ประวัติศาสตร์สโมสร ผับตำนาน และจุดสำคัญของทีม เล่าไทยได้ ตอบคำถามลึกได้",
    [
      { title: "ทัวร์เดินประวัติศาสตร์ผี ครึ่งวัน", priceThb: 2_200, pricingModel: "per_person", capacity: 12, matchdayReady: false },
      { title: "พาเข้าสนามวันแข่ง + ดูแลทั้งวัน", priceThb: 5_500, pricingModel: "per_person", capacity: 8, matchdayReady: true },
    ],
    { rating: 4.9, reviewCount: 33 },
  ),
  sample(
    "stay_1", "stay", "บ้านพักคนไทย Northern Quarter", "Manchester",
    ["Northern Quarter"],
    "อพาร์ตเมนต์ 2 ห้องนอนใจกลางเมือง เดินไปสถานี Piccadilly 8 นาที มีหม้อหุงข้าวและเครื่องปรุงไทยครบ",
    [
      { title: "ห้องนอนคู่ (พัก 2 คน)", priceThb: 3_200, pricingModel: "per_night", capacity: 2, matchdayReady: true },
      { title: "เหมาทั้งยูนิต (พักได้ 5 คน)", priceThb: 6_400, pricingModel: "per_night", capacity: 5, matchdayReady: true },
    ],
    { rating: 4.8, reviewCount: 56 },
  ),
  sample(
    "food_1", "restaurant", "ครัวคุณแม่ Rusholme", "Manchester",
    ["Rusholme", "Curry Mile"],
    "ร้านอาหารไทยรสจัดจ้าน รับจองโต๊ะหมู่คณะและทำเมนูสั่งพิเศษสำหรับกรุ๊ปทัวร์ เปิดถึงเที่ยงคืนวันแข่ง",
    [
      { title: "เซ็ตอาหารไทยหมู่คณะ (ต่อคน)", priceThb: 850, pricingModel: "per_person", capacity: 40, matchdayReady: true },
      { title: "จองโต๊ะหลังเกม (มัดจำต่อโต๊ะ)", priceThb: 1_200, pricingModel: "per_person", capacity: 10, matchdayReady: true },
    ],
    { rating: 4.6, reviewCount: 88 },
  ),
  sample(
    "massage_1", "massage", "สบายนวดไทย Deansgate", "Manchester",
    ["Deansgate", "City Centre"],
    "หมอนวดใบประกอบวิชาชีพไทย นวดแผนไทยและนวดกีฬา เปิดถึงสี่ทุ่ม เหมาะกับคืนที่เพิ่งลงจากเครื่องหรือหลังเดินทั้งวัน",
    [
      { title: "นวดแผนไทย 60 นาที", priceThb: 1_500, pricingModel: "per_person", capacity: 4, matchdayReady: true },
      { title: "นวดกีฬาแก้เจ็ตแล็ก 90 นาที", priceThb: 2_300, pricingModel: "per_person", capacity: 4, matchdayReady: true },
    ],
    { rating: 4.9, reviewCount: 61 },
  ),
  sample(
    "massage_2", "massage", "ไทยสปา Bayswater", "London",
    ["Bayswater", "Paddington"],
    "ร้านนวดไทยย่านลอนดอนตะวันตก รับจองเป็นกรุ๊ป มีห้องรวมสำหรับ 4 คนพร้อมกัน",
    [
      { title: "นวดเท้า 45 นาที", priceThb: 1_250, pricingModel: "per_person", capacity: 4, matchdayReady: false },
      { title: "นวดน้ำมัน 90 นาที", priceThb: 2_600, pricingModel: "per_person", capacity: 4, matchdayReady: false },
    ],
    { rating: 4.7, reviewCount: 37 },
  ),
];

export function isSamplePartner(partner: Partner) {
  return partner.id.startsWith("sample_");
}
