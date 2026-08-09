export type StadiumTravelPlan = {
  stadium: string;
  distanceKm: number;
  railMinutes: number;
  lastMileMinutes: number;
  mode: "train" | "tram";
  origin: string;
  destination: string;
  via: readonly string[];
  lastMile: string;
  note?: string;
  plannerUrl: string;
};

export const NATIONAL_RAIL_JOURNEY_PLANNER = "https://www.nationalrail.co.uk/journey-planner/";
export const NATIONAL_RAIL_TIMETABLE_GUIDANCE = "https://www.nationalrail.co.uk/travel-information/timetable-information/";
export const TFGM_TRAM_PLANNER = "https://tfgm.com/plan-a-journey";

// Planning baselines from central Manchester to the turnstile, split so each
// number can be checked on its own:
//   distanceKm      approximate rail route distance, not straight-line
//   railMinutes     origin station -> destination station, typical off-peak service
//   lastMileMinutes destination station -> ground, including any local metro/tube
// They are typical off-peak averages, not live rail timetables. Match-specific
// target times are calculated in the UI from each kick-off, and the journey
// planner links remain the only authority on real departures.
export const STADIUM_TRAVEL_PLANS: readonly StadiumTravelPlan[] = [
  {
    stadium: "Old Trafford",
    distanceKm: 6,
    railMinutes: 20,
    lastMileMinutes: 10,
    mode: "tram",
    origin: "Manchester Piccadilly",
    destination: "Old Trafford Metrolink",
    via: ["Piccadilly Metrolink", "Cornbrook (เปลี่ยนสาย)", "Old Trafford Metrolink"],
    lastMile: "เดินจากป้าย Old Trafford ประมาณ 8–10 นาที",
    note: "วันแข่งรถรางแน่น ควรเผื่อเวลาต่อคิวหลังจบเกม",
    plannerUrl: TFGM_TRAM_PLANNER,
  },
  {
    stadium: "MKM Stadium",
    distanceKm: 150,
    railMinutes: 135,
    lastMileMinutes: 30,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Hull Paragon Interchange",
    via: ["Manchester Piccadilly", "Leeds (บางเที่ยวต้องเปลี่ยนขบวน)", "Hull Paragon"],
    lastMile: "เดิน 25–35 นาที หรือใช้รถบัส/แท็กซี่จาก Hull Paragon",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Portman Road",
    distanceKm: 400,
    railMinutes: 260,
    lastMileMinutes: 10,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Ipswich",
    via: ["Manchester Piccadilly", "London Euston", "London Liverpool Street", "Ipswich"],
    lastMile: "เดินจากสถานี Ipswich ประมาณ 5–10 นาที",
    note: "เวลารถไฟรวมช่วงข้ามลอนดอนจาก Euston ไป Liverpool Street ด้วย Underground แล้ว",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Hill Dickinson Stadium",
    distanceKm: 57,
    railMinutes: 55,
    lastMileMinutes: 25,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Sandhills",
    via: ["Manchester Piccadilly", "Liverpool Lime Street", "Moorfields", "Sandhills"],
    lastMile: "เดินราว 20 นาที หรือตรวจรถรับส่งวันแข่งไป Bramley-Moore Dock",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Etihad Stadium",
    distanceKm: 4,
    railMinutes: 13,
    lastMileMinutes: 5,
    mode: "tram",
    origin: "Manchester Piccadilly",
    destination: "Etihad Campus Metrolink",
    via: ["Piccadilly Metrolink", "Etihad Campus Metrolink"],
    lastMile: "ป้ายอยู่ติดสนาม เดินประมาณ 2–5 นาที",
    note: "หลังจบเกมอาจมีระบบจัดคิวที่ป้าย Etihad Campus",
    plannerUrl: TFGM_TRAM_PLANNER,
  },
  {
    stadium: "Craven Cottage",
    distanceKm: 305,
    railMinutes: 130,
    lastMileMinutes: 40,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Putney Bridge Underground",
    via: ["Manchester Piccadilly", "London Euston", "Victoria / District line", "Putney Bridge"],
    lastMile: "District line ต่อจาก Euston แล้วเดินเลียบ Bishop's Park อีก 15–20 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Tottenham Hotspur Stadium",
    distanceKm: 305,
    railMinutes: 130,
    lastMileMinutes: 35,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "White Hart Lane",
    via: ["Manchester Piccadilly", "London Euston", "Seven Sisters", "White Hart Lane"],
    lastMile: "Victoria line ไป Seven Sisters ต่อรถไฟถึง White Hart Lane แล้วเดินอีก 5 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Elland Road",
    distanceKm: 70,
    railMinutes: 60,
    lastMileMinutes: 20,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Leeds",
    via: ["Manchester Piccadilly", "Leeds"],
    lastMile: "ต่อรถบัสวันแข่งหรือแท็กซี่ 15–25 นาทีไป Elland Road",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Vitality Stadium",
    distanceKm: 400,
    railMinutes: 290,
    lastMileMinutes: 15,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Pokesdown",
    via: ["Manchester Piccadilly", "Birmingham New Street", "Bournemouth / Pokesdown"],
    lastMile: "จาก Pokesdown เดินประมาณ 15 นาที; บางเที่ยวลง Bournemouth แล้วต่อรถท้องถิ่น",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Stamford Bridge",
    distanceKm: 305,
    railMinutes: 130,
    lastMileMinutes: 30,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Fulham Broadway Underground",
    via: ["Manchester Piccadilly", "London Euston", "Victoria / District line", "Fulham Broadway"],
    lastMile: "District line ต่อจาก Euston แล้วเดินจาก Fulham Broadway อีก 5 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Villa Park",
    distanceKm: 130,
    railMinutes: 90,
    lastMileMinutes: 15,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Witton",
    via: ["Manchester Piccadilly", "Birmingham New Street", "Witton"],
    lastMile: "ต่อรถไฟท้องถิ่นไป Witton แล้วเดินอีกประมาณ 5 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Anfield",
    distanceKm: 55,
    railMinutes: 50,
    lastMileMinutes: 25,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Liverpool Lime Street",
    via: ["Manchester Piccadilly", "Liverpool Lime Street"],
    lastMile: "ต่อรถบัส Soccerbus/รถเมล์ท้องถิ่นหรือแท็กซี่ 20–30 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Gtech Community Stadium",
    distanceKm: 305,
    railMinutes: 130,
    lastMileMinutes: 35,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Kew Bridge",
    via: ["Manchester Piccadilly", "London Euston", "London Underground", "Kew Bridge"],
    lastMile: "ต่อ Underground/Overground ถึง Kew Bridge แล้วเดินอีก 5 นาที (Gunnersbury เป็นทางเลือก)",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "St James' Park",
    distanceKm: 220,
    railMinutes: 150,
    lastMileMinutes: 15,
    mode: "train",
    origin: "Manchester Victoria",
    destination: "Newcastle",
    via: ["Manchester Victoria", "York (ขึ้นกับเที่ยว)", "Newcastle"],
    lastMile: "เดินจาก Newcastle Central ประมาณ 10–15 นาที หรือใช้ Metro ไป St James",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Coventry Building Society Arena",
    distanceKm: 160,
    railMinutes: 115,
    lastMileMinutes: 5,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Coventry Arena",
    via: ["Manchester Piccadilly", "Birmingham New Street", "Coventry", "Coventry Arena"],
    lastMile: "สถานี Coventry Arena อยู่ติดสนาม เดินประมาณ 2–5 นาที",
    note: "บริการเข้าสถานี Coventry Arena วันแข่งอาจถูกจัดการเป็นพิเศษ ตรวจประกาศก่อนเดินทาง",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Selhurst Park",
    distanceKm: 315,
    railMinutes: 130,
    lastMileMinutes: 50,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Selhurst",
    via: ["Manchester Piccadilly", "London Euston", "London Victoria", "Selhurst / Norwood Junction"],
    lastMile: "ข้ามไป Victoria แล้วต่อรถไฟลงใต้ จากนั้นเดินอีก 10–15 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Emirates Stadium",
    distanceKm: 300,
    railMinutes: 130,
    lastMileMinutes: 25,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Arsenal Underground",
    via: ["Manchester Piccadilly", "London Euston", "King's Cross St Pancras", "Arsenal"],
    lastMile: "Piccadilly line จาก King's Cross แล้วเดินจาก Arsenal อีก 5 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "City Ground",
    distanceKm: 110,
    railMinutes: 110,
    lastMileMinutes: 20,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Nottingham",
    via: ["Manchester Piccadilly", "Sheffield", "Nottingham"],
    lastMile: "ต่อรถบัสหรือแท็กซี่ 15–25 นาที; เดินประมาณ 30 นาที",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "Stadium of Light",
    distanceKm: 235,
    railMinutes: 175,
    lastMileMinutes: 5,
    mode: "train",
    origin: "Manchester Victoria",
    destination: "Stadium of Light Metro",
    via: ["Manchester Victoria", "Newcastle", "Tyne and Wear Metro", "Stadium of Light"],
    lastMile: "เดินจาก Metro ประมาณ 5 นาที",
    note: "เวลารถไฟรวมช่วงต่อ Tyne and Wear Metro จาก Newcastle แล้ว",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
  {
    stadium: "American Express Stadium",
    distanceKm: 420,
    railMinutes: 275,
    lastMileMinutes: 5,
    mode: "train",
    origin: "Manchester Piccadilly",
    destination: "Falmer",
    via: ["Manchester Piccadilly", "London Euston", "London Victoria", "Brighton", "Falmer"],
    lastMile: "สถานี Falmer อยู่ติดสนาม เดินประมาณ 2–5 นาที",
    note: "เผื่อเวลาต่อคิวรถไฟที่ Falmer หลังเกม และตรวจเที่ยวสุดท้ายกลับลอนดอน/แมนเชสเตอร์",
    plannerUrl: NATIONAL_RAIL_JOURNEY_PLANNER,
  },
] as const;

export function getStadiumTravelPlan(stadium: string) {
  return STADIUM_TRAVEL_PLANS.find((plan) => plan.stadium === stadium);
}

/** Door-to-door planning total: station-to-station plus the local leg. */
export function totalTravelMinutes(plan: StadiumTravelPlan) {
  return plan.railMinutes + plan.lastMileMinutes;
}
