// ชนิดข้อมูลกลางของระบบวางแผนทริปดูบอล — ใช้ร่วมกันทุก service
// UI ห้ามคำนวณราคาหรือกติกาการเดินทางเอง ให้เรียกผ่าน service เท่านั้น (STEP 31)

export type DestinationCity = "London" | "Manchester";

export type DepartureAirport = {
  code: string;
  name: string;
  city: string;
};

export type ArrivalAirport = {
  code: string;
  name: string;
  city: DestinationCity;
  /** นาทีจากสนามบินถึงใจกลางเมืองด้วยรถไฟ/รถรับส่ง — ใช้คำนวณเวลาถึงโรงแรม */
  minutesToCityCentre: number;
};

/** ระดับงบ 3 แบบตาม STEP 7 — ตัวคูณจริงอยู่ใน services/pricing */
export type BudgetStyle = "saver" | "comfort" | "premium";

export type TripLength = 5 | 8 | 10;

export type TripSelection = {
  fixtureKey: string | null;
  city: DestinationCity;
  arrivalAirport: string;
  departDate: string; // YYYY-MM-DD ออกจากกรุงเทพ
  returnDate: string; // YYYY-MM-DD ถึงกรุงเทพ
  length: TripLength;
  travellers: number;
  budget: BudgetStyle;
};

export type CostLine = {
  key: string;
  label: string;
  /** บาทต่อคน */
  amount: number;
  note?: string;
};

export type TripEstimate = {
  perPerson: number;
  total: number;
  nights: number;
  lines: CostLine[];
};

export const BUDGET_LABELS: Record<BudgetStyle, { name: string; tagline: string }> = {
  saver: { name: "Smart Saver", tagline: "ได้บอลครบ คุมค่าใช้จ่าย" },
  comfort: { name: "Comfort", tagline: "สมดุลระหว่างสบายกับราคา" },
  premium: { name: "Premium", tagline: "ทริปบอลแบบไม่ต้องประหยัด" },
};
