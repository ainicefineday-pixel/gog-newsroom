// อะแดปเตอร์ไฟลต์ — ตอนนี้เป็นข้อมูลจำลองที่ติดป้ายชัดเจนว่า "ประมาณการ" (STEP 32)
// ห้ามแสดงเป็นราคาจริง/ที่นั่งว่างจริง จนกว่าจะต่อ flight search API

import type { ArrivalAirport, BudgetStyle, DepartureAirport } from "@/services/trip/types";

export const BANGKOK: DepartureAirport = {
  code: "BKK",
  name: "ท่าอากาศยานสุวรรณภูมิ",
  city: "กรุงเทพฯ",
};

export const ARRIVAL_AIRPORTS: ArrivalAirport[] = [
  { code: "LHR", name: "London Heathrow", city: "London", minutesToCityCentre: 45 },
  { code: "LGW", name: "London Gatwick", city: "London", minutesToCityCentre: 55 },
  { code: "MAN", name: "Manchester Airport", city: "Manchester", minutesToCityCentre: 20 },
];

export type FlightOption = {
  id: string;
  airline: string;
  arrivalCode: string;
  /** เวลาออกจาก BKK และถึงปลายทาง (เวลาท้องถิ่นของแต่ละที่) */
  departLocal: string;
  arriveLocal: string;
  durationMinutes: number;
  stops: number;
  via?: string;
  baggageKg: number;
  /** บาทต่อคน ไป-กลับ — ประมาณการ */
  estimatedFare: Record<BudgetStyle, number>;
  /** ถึงตอนเช้า = มีเวลาทั้งวันให้พักก่อนวันแข่ง */
  arrivesMorning: boolean;
};

// ราคาอ้างอิงช่วงนอกไฮซีซัน จองล่วงหน้า 2-3 เดือน — ปรับได้เมื่อมีข้อมูลจริง
export const FLIGHT_OPTIONS: FlightOption[] = [
  {
    id: "tg-lhr-direct",
    airline: "Thai Airways",
    arrivalCode: "LHR",
    departLocal: "00:15",
    arriveLocal: "06:30",
    durationMinutes: 745,
    stops: 0,
    baggageKg: 30,
    estimatedFare: { saver: 32_000, comfort: 41_000, premium: 96_000 },
    arrivesMorning: true,
  },
  {
    id: "eva-lhr-direct",
    airline: "EVA Air",
    arrivalCode: "LHR",
    departLocal: "23:55",
    arriveLocal: "06:05",
    durationMinutes: 730,
    stops: 0,
    baggageKg: 30,
    estimatedFare: { saver: 30_500, comfort: 39_500, premium: 92_000 },
    arrivesMorning: true,
  },
  {
    id: "qr-lhr-doha",
    airline: "Qatar Airways",
    arrivalCode: "LHR",
    departLocal: "02:10",
    arriveLocal: "13:40",
    durationMinutes: 1_050,
    stops: 1,
    via: "โดฮา (DOH)",
    baggageKg: 30,
    estimatedFare: { saver: 26_500, comfort: 35_000, premium: 88_000 },
    arrivesMorning: false,
  },
  {
    id: "ek-lgw-dubai",
    airline: "Emirates",
    arrivalCode: "LGW",
    departLocal: "01:35",
    arriveLocal: "13:10",
    durationMinutes: 1_055,
    stops: 1,
    via: "ดูไบ (DXB)",
    baggageKg: 30,
    estimatedFare: { saver: 25_800, comfort: 34_000, premium: 84_000 },
    arrivesMorning: false,
  },
  {
    id: "qr-man-doha",
    airline: "Qatar Airways",
    arrivalCode: "MAN",
    departLocal: "02:10",
    arriveLocal: "13:15",
    durationMinutes: 1_025,
    stops: 1,
    via: "โดฮา (DOH)",
    baggageKg: 30,
    estimatedFare: { saver: 28_000, comfort: 36_500, premium: 90_000 },
    arrivesMorning: false,
  },
  {
    id: "ek-man-dubai",
    airline: "Emirates",
    arrivalCode: "MAN",
    departLocal: "01:35",
    arriveLocal: "12:40",
    durationMinutes: 1_025,
    stops: 1,
    via: "ดูไบ (DXB)",
    baggageKg: 30,
    estimatedFare: { saver: 27_400, comfort: 35_800, premium: 88_500 },
    arrivesMorning: false,
  },
  {
    id: "ey-man-abudhabi",
    airline: "Etihad Airways",
    arrivalCode: "MAN",
    departLocal: "20:05",
    arriveLocal: "07:35",
    durationMinutes: 1_050,
    stops: 1,
    via: "อาบูดาบี (AUH)",
    baggageKg: 30,
    estimatedFare: { saver: 26_900, comfort: 35_200, premium: 86_000 },
    arrivesMorning: true,
  },
];

export type FlightSort = "best" | "cheapest" | "fastest" | "arrival";

export function listFlights(arrivalCodes: string[], budget: BudgetStyle, sort: FlightSort = "best") {
  const options = FLIGHT_OPTIONS.filter((flight) => arrivalCodes.includes(flight.arrivalCode));
  const scored = [...options];
  switch (sort) {
    case "cheapest":
      return scored.sort((a, b) => a.estimatedFare[budget] - b.estimatedFare[budget]);
    case "fastest":
      return scored.sort((a, b) => a.durationMinutes - b.durationMinutes);
    case "arrival":
      return scored.sort((a, b) => Number(b.arrivesMorning) - Number(a.arrivesMorning));
    default:
      // "ดีที่สุด" = ถ่วงราคากับเวลาบิน แล้วให้แต้มพิเศษกับบินตรงและถึงตอนเช้า
      return scored.sort((a, b) => bestScore(a, budget) - bestScore(b, budget));
  }
}

function bestScore(flight: FlightOption, budget: BudgetStyle) {
  const fare = flight.estimatedFare[budget] / 1_000;
  const hours = flight.durationMinutes / 60;
  return fare + hours * 1.4 + flight.stops * 3 - (flight.arrivesMorning ? 2.5 : 0);
}

/**
 * เตือนเมื่อไฟลต์ลงจอดกระชั้นกับเวลาเตะ (STEP 8)
 * บิน BKK→UK ~12-17 ชม. + เจ็ตแล็ก 6-7 ชม. ควรถึงก่อนวันแข่งอย่างน้อย 1 วันเต็ม
 */
export function arrivalWarning(arriveDate: string, matchDate: string | null) {
  if (!matchDate) return null;
  const gapDays = Math.round(
    (new Date(`${matchDate}T00:00:00Z`).getTime() - new Date(`${arriveDate}T00:00:00Z`).getTime()) / 86_400_000,
  );
  if (gapDays < 0) return "ไฟลต์ถึงหลังเกมจบแล้ว — เลื่อนวันออกเดินทางให้เร็วขึ้น";
  if (gapDays === 0) return "ถึงอังกฤษวันเดียวกับวันแข่ง เสี่ยงมากถ้าไฟลต์ดีเลย์ — แนะนำถึงก่อนอย่างน้อย 1 วัน";
  if (gapDays === 1) return "ถึงก่อนวันแข่ง 1 วัน พอไหวแต่แทบไม่มีเวลาปรับเจ็ตแล็ก";
  return null;
}
