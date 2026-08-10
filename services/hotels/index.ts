// อะแดปเตอร์โรงแรม — ข้อมูลจำลองติดป้าย "ประมาณการ" (STEP 32)
// จัดกลุ่มตามโซนที่แฟนบอลใช้จริง พร้อมเหตุผลว่าทำไม GOG ถึงแนะนำ (STEP 9)

import type { BudgetStyle, DestinationCity } from "@/services/trip/types";

export type HotelOption = {
  id: string;
  name: string;
  city: DestinationCity;
  area: string;
  stars: 3 | 4 | 5;
  budget: BudgetStyle;
  /** บาทต่อคืนต่อห้อง — ประมาณการ */
  nightlyThb: number;
  minutesToCityCentre: number;
  minutesToStadium: number;
  nearestStation: string;
  /** ทำไมถึงแนะนำ — ใช้เป็นป้าย "Best for:" บนการ์ด */
  bestFor: string;
  why: string;
};

export const HOTEL_OPTIONS: HotelOption[] = [
  // ── แมนเชสเตอร์ ───────────────────────────────────────────────────────────
  {
    id: "man-piccadilly-3",
    name: "โรงแรมย่านพิคคาดิลลี (ระดับ 3 ดาว)",
    city: "Manchester",
    area: "Manchester Piccadilly",
    stars: 3,
    budget: "saver",
    nightlyThb: 3_400,
    minutesToCityCentre: 5,
    minutesToStadium: 30,
    nearestStation: "Manchester Piccadilly",
    bestFor: "นักเดินทางงบประหยัด",
    why: "ติดสถานีรถไฟหลัก ไปโอลด์ แทรฟฟอร์ดต่อ Metrolink สายเดียว และกลับจากสนามบินสะดวกที่สุด",
  },
  {
    id: "man-northern-quarter-4",
    name: "โรงแรมย่าน Northern Quarter (ระดับ 4 ดาว)",
    city: "Manchester",
    area: "Northern Quarter",
    stars: 4,
    budget: "comfort",
    nightlyThb: 5_600,
    minutesToCityCentre: 3,
    minutesToStadium: 32,
    nearestStation: "Shudehill",
    bestFor: "ร้านกาแฟและชีวิตกลางคืน",
    why: "ย่านคาเฟ่คั่วเองและผับดี ๆ หนาแน่นที่สุดในเมือง เดินกลับโรงแรมได้หลังดูบอลค่ำ",
  },
  {
    id: "man-deansgate-4",
    name: "โรงแรมย่าน Deansgate (ระดับ 4 ดาว)",
    city: "Manchester",
    area: "Deansgate",
    stars: 4,
    budget: "comfort",
    nightlyThb: 6_200,
    minutesToCityCentre: 4,
    minutesToStadium: 22,
    nearestStation: "Deansgate-Castlefield",
    bestFor: "เดินทางไปสนามง่าย",
    why: "ขึ้น Metrolink สาย Altrincham ตรงถึงป้าย Old Trafford ไม่ต้องต่อรถ วันแข่งประหยัดเวลาที่สุด",
  },
  {
    id: "man-old-trafford-5",
    name: "โรงแรมระดับพรีเมียมใกล้โอลด์ แทรฟฟอร์ด",
    city: "Manchester",
    area: "Old Trafford / Salford Quays",
    stars: 5,
    budget: "premium",
    nightlyThb: 11_500,
    minutesToCityCentre: 18,
    minutesToStadium: 12,
    nearestStation: "Old Trafford (Metrolink)",
    bestFor: "แฟนผีที่มาเพื่อสนามโดยเฉพาะ",
    why: "เดินถึงสนามได้ในวันแข่ง ตื่นมาเห็นสนามจากห้อง เหมาะกับทริปที่ให้บอลเป็นหัวใจ",
  },
  // ── ลอนดอน ──────────────────────────────────────────────────────────────
  {
    id: "lon-kings-cross-3",
    name: "โรงแรมย่าน King's Cross (ระดับ 3 ดาว)",
    city: "London",
    area: "King's Cross",
    stars: 3,
    budget: "saver",
    nightlyThb: 4_600,
    minutesToCityCentre: 10,
    minutesToStadium: 25,
    nearestStation: "King's Cross St Pancras",
    bestFor: "ไปเมืองอื่นต่อ",
    why: "ชุมทางรถไฟใหญ่ที่สุด นั่งตรงไปแมนเชสเตอร์/ลิเวอร์พูลได้ และมีรถใต้ดิน 6 สาย",
  },
  {
    id: "lon-paddington-4",
    name: "โรงแรมย่าน Paddington (ระดับ 4 ดาว)",
    city: "London",
    area: "Paddington",
    stars: 4,
    budget: "comfort",
    nightlyThb: 7_200,
    minutesToCityCentre: 12,
    minutesToStadium: 30,
    nearestStation: "Paddington",
    bestFor: "มาถึงฮีทโธรว์",
    why: "Heathrow Express 15 นาทีถึงโรงแรม เหมาะกับวันแรกที่เหนื่อยจากไฟลต์ยาว",
  },
  {
    id: "lon-westend-4",
    name: "โรงแรมย่าน West End (ระดับ 4 ดาว)",
    city: "London",
    area: "West End / Soho",
    stars: 4,
    budget: "comfort",
    nightlyThb: 8_100,
    minutesToCityCentre: 2,
    minutesToStadium: 28,
    nearestStation: "Tottenham Court Road",
    bestFor: "มาลอนดอนครั้งแรก",
    why: "เดินถึงร้านอาหาร โรงละคร และแหล่งช้อป กลับดึกหลังเกมเย็นก็ยังหาของกินได้",
  },
  {
    id: "lon-mayfair-5",
    name: "โรงแรมระดับพรีเมียมย่าน Mayfair",
    city: "London",
    area: "Mayfair",
    stars: 5,
    budget: "premium",
    nightlyThb: 16_800,
    minutesToCityCentre: 5,
    minutesToStadium: 32,
    nearestStation: "Green Park",
    bestFor: "ทริปฉลองโอกาสพิเศษ",
    why: "บริการระดับสูงและรถรับส่งส่วนตัว เหมาะกับแพ็กเกจ hospitality ในวันแข่ง",
  },
];

export function listHotels(city: DestinationCity, budget: BudgetStyle) {
  const inCity = HOTEL_OPTIONS.filter((hotel) => hotel.city === city);
  const matching = inCity.filter((hotel) => hotel.budget === budget);
  // ระดับงบไหนไม่มีตัวเลือกในเมืองนั้น ให้แสดงทั้งเมืองไว้ก่อน ดีกว่าโชว์ว่าง
  return (matching.length ? matching : inCity).sort((a, b) => a.nightlyThb - b.nightlyThb);
}

export function defaultHotel(city: DestinationCity, budget: BudgetStyle) {
  return listHotels(city, budget)[0] ?? null;
}
