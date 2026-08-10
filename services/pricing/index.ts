// ตรรกะราคาทั้งหมดอยู่ที่นี่ที่เดียว — UI แค่เรียกแล้วเอาไปวาด (STEP 31)
// ตัวเลขทุกตัวเป็น "ประมาณการเพื่อวางแผน" ไม่ใช่ราคาจริงที่จองได้ (STEP 6 / STEP 32)

import type { BudgetStyle, CostLine, DestinationCity, TripEstimate, TripLength } from "@/services/trip/types";

/** อัตราแลกเปลี่ยนอ้างอิงสำหรับสลับหน่วยแสดงผล — ไม่ใช่เรตซื้อขายจริง */
export const GBP_TO_THB = 44;

type DailyRates = {
  /** ต่อวันต่อคน (บาท) */
  food: number;
  localTransport: number;
  attractions: number;
};

const DAILY_BY_BUDGET: Record<BudgetStyle, DailyRates> = {
  saver: { food: 1_100, localTransport: 350, attractions: 400 },
  comfort: { food: 2_000, localTransport: 550, attractions: 800 },
  premium: { food: 4_200, localTransport: 1_400, attractions: 1_600 },
};

/** ค่ารถรับส่งสนามบิน ไป-กลับ ต่อคน */
const AIRPORT_TRANSFER: Record<BudgetStyle, Record<DestinationCity, number>> = {
  saver: { London: 900, Manchester: 500 },
  comfort: { London: 1_900, Manchester: 1_100 },
  premium: { London: 5_200, Manchester: 3_400 },
};

/** ตั๋วเข้าสนาม — ราคาเฉลี่ยที่แฟนต่างชาติจ่ายจริงผ่านช่องทางที่ถูกกฎ */
const MATCH_TICKET: Record<BudgetStyle, number> = {
  saver: 4_800,
  comfort: 8_500,
  premium: 26_000,
};

/** ทัวร์สนาม + พิพิธภัณฑ์สโมสร */
const STADIUM_TOUR: Record<BudgetStyle, number> = {
  saver: 1_400,
  comfort: 1_900,
  premium: 4_500,
};

/** กิจกรรมบอลเสริม (ผับตำนาน ทัวร์ประวัติศาสตร์ ฟุตบอลมิวเซียม) ตลอดทริป */
const FOOTBALL_EXTRAS: Record<BudgetStyle, number> = {
  saver: 1_200,
  comfort: 2_600,
  premium: 7_000,
};

export type EstimateInput = {
  length: TripLength;
  nights: number;
  city: DestinationCity;
  budget: BudgetStyle;
  travellers: number;
  /** บาทต่อคน ไป-กลับ จาก services/flights */
  flightFare: number;
  /** บาทต่อคืนต่อห้อง จาก services/hotels */
  hotelNightly: number;
  /** ใส่ตั๋วเข้าสนามหรือไม่ — ทริปที่ยังไม่ได้เลือกแมตช์จะไม่คิด */
  includeMatch: boolean;
  /** บรรทัดที่ผู้ใช้กดเพิ่มเข้าทริปเอง เช่น ค่าวีซ่า (บาทต่อคน) — ต่อท้ายรายการมาตรฐาน */
  extraLines?: CostLine[];
};

export function estimateTrip(input: EstimateInput): TripEstimate {
  const daily = DAILY_BY_BUDGET[input.budget];
  // คิดห้องพัก 2 คน/ห้องเมื่อไปหลายคน — เดินทางคนเดียวจ่ายเต็มห้อง
  const occupancy = input.travellers >= 2 ? 2 : 1;
  const hotelPerPerson = Math.round((input.hotelNightly * input.nights) / occupancy);

  const lines: CostLine[] = [
    {
      key: "flight",
      label: "ตั๋วเครื่องบิน ไป-กลับ",
      amount: input.flightFare,
      note: "BKK → UK · ประมาณการจากราคาช่วงจองล่วงหน้า 2–3 เดือน",
    },
    {
      key: "hotel",
      label: `ที่พัก ${input.nights} คืน`,
      amount: hotelPerPerson,
      note: occupancy === 2 ? "คิดแบบพัก 2 คนต่อห้อง" : "คิดแบบพักคนเดียวเต็มห้อง",
    },
    {
      key: "transfer",
      label: "รถรับส่งสนามบิน",
      amount: AIRPORT_TRANSFER[input.budget][input.city],
    },
    {
      key: "local",
      label: "เดินทางในเมือง",
      amount: daily.localTransport * input.length,
      note: input.city === "Manchester" ? "Metrolink + รถไฟในเมือง" : "Underground + รถไฟในเมือง",
    },
    ...(input.includeMatch
      ? [
          { key: "ticket", label: "ตั๋วเข้าสนาม", amount: MATCH_TICKET[input.budget] },
          { key: "tour", label: "ทัวร์สนาม + พิพิธภัณฑ์", amount: STADIUM_TOUR[input.budget] },
        ]
      : []),
    { key: "food", label: "ค่าอาหาร", amount: daily.food * input.length },
    { key: "attractions", label: "ที่เที่ยว/พิพิธภัณฑ์", amount: daily.attractions * input.length },
    { key: "football", label: "กิจกรรมสายบอลเพิ่มเติม", amount: FOOTBALL_EXTRAS[input.budget] },
    ...(input.extraLines ?? []),
  ];

  const perPerson = lines.reduce((sum, line) => sum + line.amount, 0);
  return {
    perPerson,
    total: perPerson * Math.max(input.travellers, 1),
    nights: input.nights,
    lines,
  };
}

export function formatThb(amount: number) {
  return `฿${Math.round(amount).toLocaleString("th-TH")}`;
}

export function formatGbp(amountThb: number) {
  return `£${Math.round(amountThb / GBP_TO_THB).toLocaleString("en-GB")}`;
}

export function formatMoney(amountThb: number, currency: "THB" | "GBP") {
  return currency === "THB" ? formatThb(amountThb) : formatGbp(amountThb);
}
