// สร้างแผนเที่ยวรายวันอัตโนมัติ (STEP 11, 12, 21)
// ---------------------------------------------------------------------------
// หลักการจัดวัน: วันแข่งเป็นหมุดตายตัว วันอื่นจัดรอบมัน
//   - วันแรกคือวันบินถึง ไม่ยัดกิจกรรมหนัก เพราะบิน 12-17 ชม. + เจ็ตแล็ก 6 ชม.
//   - วันก่อนแข่งเป็นวันบอล (ทัวร์สนาม/พิพิธภัณฑ์) เพื่ออุ่นเครื่องอารมณ์
//   - วันแข่งจัดแบบถอยหลังจากเวลาเตะ ไม่ใส่กิจกรรมยาวชนกับเวลาเข้าสนาม
//   - วันสุดท้ายเผื่อเวลาไปสนามบิน 3 ชม. ก่อนเครื่องออก
// ทุกอย่างคืนเป็นข้อมูลล้วน ไม่มี JSX — UI แค่เอาไปวาด (STEP 31)

import { PLACES, type Place } from "@/services/places";
import type { DestinationCity, TripLength } from "@/services/trip/types";

export type DayTheme = "arrival" | "football" | "matchday" | "city" | "daytrip" | "departure";

export type ItineraryItem = {
  /** id ของสถานที่ต้นทาง — มีเฉพาะรายการที่มาจากคลังสถานที่ (ใช้ตอนตัดออก/เพิ่มกลับ) */
  placeId?: string;
  /** เวลาแบบ HH:MM ตามเวลาท้องถิ่นอังกฤษ */
  time: string;
  title: string;
  detail: string;
  durationMinutes: number;
  costThb: number;
  area?: string;
  booking?: boolean;
  /** ไฮไลต์ในวันแข่ง เช่น เดินทางไปสนาม/เวลาเข้าสนาม */
  highlight?: boolean;
};

export type ItineraryDay = {
  dayNumber: number;
  date: string; // YYYY-MM-DD
  theme: DayTheme;
  title: string;
  summary: string;
  items: ItineraryItem[];
  costThb: number;
};

const THEME_TITLE: Record<DayTheme, string> = {
  arrival: "ถึงอังกฤษ + ปรับตัว",
  football: "วันสายบอล",
  matchday: "วันแข่ง",
  city: "สำรวจเมือง",
  daytrip: "ไปเมืองใกล้เคียง",
  departure: "เก็บของ + บินกลับ",
};

function addDays(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minutesToClock(totalMinutes: number) {
  const wrapped = ((totalMinutes % 1_440) + 1_440) % 1_440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function clockToMinutes(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

function ukKickoffClock(kickoffUtc: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(kickoffUtc));
}

/** หยิบสถานที่ตามประเภทโดยไม่ซ้ำกับที่ใช้ไปแล้วในทริปนี้ */
function pick(city: DestinationCity, kinds: Place["kind"][], used: Set<string>, count = 1) {
  const chosen: Place[] = [];
  for (const place of PLACES.filter((item) => item.city === city && kinds.includes(item.kind)).sort((a, b) => b.score - a.score)) {
    if (chosen.length >= count) break;
    if (used.has(place.id)) continue;
    used.add(place.id);
    chosen.push(place);
  }
  return chosen;
}

function toItem(place: Place, time: string, highlight = false): ItineraryItem {
  return {
    placeId: place.id,
    time,
    title: place.name,
    detail: place.why,
    durationMinutes: place.durationMinutes,
    costThb: place.costThb,
    area: place.area,
    booking: place.booking,
    highlight,
  };
}

/** ต่อกิจกรรมเรียงกันโดยเผื่อเวลาเดินทางระหว่างจุด 25 นาที */
function schedule(startClock: string, places: Place[], gapMinutes = 25) {
  let cursor = clockToMinutes(startClock);
  return places.map((place) => {
    const item = toItem(place, minutesToClock(cursor));
    cursor += place.durationMinutes + gapMinutes;
    return item;
  });
}

function sumCost(items: ItineraryItem[]) {
  return items.reduce((total, item) => total + item.costThb, 0);
}

export type ItineraryInput = {
  city: DestinationCity;
  departDate: string;
  length: TripLength;
  /** YYYY-MM-DD ของวันแข่ง — null = ยังไม่ได้เลือกแมตช์ */
  matchDate: string | null;
  kickoffUtc: string | null;
  stadium: string | null;
  /** นาทีจากโรงแรมถึงสนาม จาก services/hotels */
  minutesToStadium: number;
  /** ไฟลต์ลงจอดตอนเช้าหรือบ่าย — มีผลกับกิจกรรมวันแรก */
  arrivesMorning: boolean;
};

export function buildItinerary(input: ItineraryInput): ItineraryDay[] {
  const used = new Set<string>();
  const days: ItineraryDay[] = [];
  // บินคืนวันแรก ถึงอังกฤษวันถัดไป — วันที่ 1 ของแผนคือวันที่เหยียบอังกฤษ
  const arriveDate = addDays(input.departDate, 1);
  const totalDays = input.length - 1;

  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(arriveDate, offset);
    const dayNumber = offset + 1;
    const isLast = offset === totalDays - 1;
    const isMatchDay = input.matchDate === date;

    if (isMatchDay && input.kickoffUtc) {
      days.push(buildMatchDay(dayNumber, date, input, used));
      continue;
    }
    if (offset === 0) {
      days.push(buildArrivalDay(dayNumber, date, input, used));
      continue;
    }
    if (isLast) {
      days.push(buildDepartureDay(dayNumber, date, input, used));
      continue;
    }
    // วันก่อนวันแข่ง = วันสายบอล ที่เหลือสลับเมือง/เดย์ทริป
    const isDayBeforeMatch = input.matchDate === addDays(date, 1);
    days.push(isDayBeforeMatch
      ? buildFootballDay(dayNumber, date, input, used)
      : buildCityDay(dayNumber, date, input, used, offset));
  }

  return days;
}

function buildArrivalDay(dayNumber: number, date: string, input: ItineraryInput, used: Set<string>): ItineraryDay {
  const start = input.arrivesMorning ? "07:30" : "13:30";
  const cursor = clockToMinutes(start);
  const items: ItineraryItem[] = [
    {
      time: minutesToClock(cursor),
      title: "ลงเครื่อง + ผ่านตรวจคนเข้าเมือง",
      detail: "เผื่อเวลา 60–90 นาทีสำหรับคิว ตม. และรับกระเป๋า",
      durationMinutes: 90,
      costThb: 0,
    },
    {
      time: minutesToClock(cursor + 90),
      title: "รถไฟ/รถรับส่งเข้าเมือง แล้วเช็กอินโรงแรม",
      detail: "เก็บของแล้วอาบน้ำก่อน อย่าเพิ่งนอน — กดให้ถึงค่ำจะปรับเวลาได้เร็วกว่า",
      durationMinutes: 90,
      costThb: 0,
    },
  ];
  const [light] = pick(input.city, ["attraction"], used, 1);
  if (light) items.push(toItem(light, minutesToClock(cursor + 210)));
  const [dinner] = pick(input.city, ["food"], used, 1);
  if (dinner) items.push(toItem(dinner, minutesToClock(cursor + 210 + (light?.durationMinutes ?? 0) + 30)));

  return {
    dayNumber,
    date,
    theme: "arrival",
    title: THEME_TITLE.arrival,
    summary: "วันแรกเอาแค่พอเดินได้ — บินมา 12–17 ชม. ร่างกายยังไม่พร้อมลุยเต็มวัน",
    items,
    costThb: sumCost(items),
  };
}

function buildFootballDay(dayNumber: number, date: string, input: ItineraryInput, used: Set<string>): ItineraryDay {
  const morning = pick(input.city, ["football"], used, 1);
  const midday = pick(input.city, ["shopping", "coffee"], used, 2);
  const evening = pick(input.city, ["food", "pub"], used, 1);
  const items = schedule("09:30", [...morning, ...midday, ...evening]);
  return {
    dayNumber,
    date,
    theme: "football",
    title: THEME_TITLE.football,
    summary: "อุ่นเครื่องก่อนวันแข่ง — ทัวร์สนาม พิพิธภัณฑ์ และร้านค้าสโมสร",
    items,
    costThb: sumCost(items),
  };
}

function buildMatchDay(dayNumber: number, date: string, input: ItineraryInput, used: Set<string>): ItineraryDay {
  const kickoff = clockToMinutes(ukKickoffClock(input.kickoffUtc!));
  // ควรถึงสนามก่อนเตะ 75 นาที (คิวตรวจกระเป๋า + หาที่นั่ง + บรรยากาศก่อนเกม)
  const arriveStadium = kickoff - 75;
  const travelMinutes = input.minutesToStadium + 15;
  // หมุด pilgrimage รอบสนาม (อนุสรณ์มิวนิก / รูปปั้น Trinity) แวะก่อนเข้าประตู
  // จึงต้องออกจากโรงแรมเผื่อเวลาส่วนนี้เพิ่ม ไม่ใช่ไปแทรกหลังออกจากโรงแรมแล้ว
  const pre = pick(input.city, ["pilgrimage"], used, 1)[0];
  const preMinutes = pre ? pre.durationMinutes + 10 : 0;
  const leaveHotel = arriveStadium - travelMinutes - preMinutes;

  const items: ItineraryItem[] = [
    {
      time: minutesToClock(Math.min(leaveHotel - 150, 9 * 60)),
      title: "มื้อเช้าแบบไม่รีบ",
      detail: "กินให้อิ่มก่อนออก ของกินในสนามคิวยาวและราคาสูง",
      durationMinutes: 60,
      costThb: 350,
    },
    {
      time: minutesToClock(leaveHotel),
      title: "ออกจากโรงแรมไปสนาม",
      detail: `เผื่อเวลาเดินทาง ${input.minutesToStadium} นาที + 15 นาทีสำรอง วันแข่งรถไฟแน่นกว่าปกติมาก`,
      durationMinutes: travelMinutes,
      costThb: 150,
      highlight: true,
    },
  ];

  if (pre) {
    items.push({
      ...toItem(pre, minutesToClock(leaveHotel + travelMinutes)),
      detail: `${pre.why} — แวะก่อนเข้าประตูสนาม`,
    });
  }

  items.push(
    {
      time: minutesToClock(arriveStadium),
      title: `ถึง${input.stadium ?? "สนาม"} — เข้าประตูและหาที่นั่ง`,
      detail: "เช็กกฎกระเป๋าของสนามก่อนออกจากโรงแรม ส่วนใหญ่ห้ามกระเป๋าใหญ่กว่า A4",
      durationMinutes: 75,
      costThb: 0,
      highlight: true,
    },
    {
      time: minutesToClock(kickoff),
      title: "คิกออฟ",
      detail: "90 นาที + ทดเวลา · เผื่อรวมพักครึ่งประมาณ 2 ชั่วโมง",
      durationMinutes: 120,
      costThb: 0,
      highlight: true,
    },
    {
      time: minutesToClock(kickoff + 130),
      title: "ออกจากสนาม — รอให้คนบางลงก่อน",
      detail: "รถไฟหลังเกมแน่นมาก รอ 20–30 นาทีสบายกว่าเบียดออกทันที",
      durationMinutes: 45,
      costThb: 150,
    },
  );

  const after = pick(input.city, ["pub", "food"], used, 1)[0];
  if (after) items.push(toItem(after, minutesToClock(kickoff + 190)));

  items.sort((a, b) => clockToMinutes(a.time) - clockToMinutes(b.time));

  return {
    dayNumber,
    date,
    theme: "matchday",
    title: THEME_TITLE.matchday,
    summary: `เวลาเตะ ${ukKickoffClock(input.kickoffUtc!)} ตามเวลาอังกฤษ — ทั้งวันจัดถอยหลังจากเวลานี้`,
    items,
    costThb: sumCost(items),
  };
}

function buildCityDay(dayNumber: number, date: string, input: ItineraryInput, used: Set<string>, offset: number): ItineraryDay {
  const kinds: Place["kind"][] = offset % 2 === 0
    ? ["attraction", "coffee", "food"]
    : ["attraction", "shopping", "thai-food"];
  const places = [
    ...pick(input.city, [kinds[0]], used, 1),
    ...pick(input.city, [kinds[1]], used, 1),
    ...pick(input.city, [kinds[2]], used, 1),
  ];
  const items = schedule("10:00", places);
  return {
    dayNumber,
    date,
    theme: "city",
    title: THEME_TITLE.city,
    summary: "วันพักจากบอล — เที่ยวเมือง กินของอร่อย และเก็บของฝาก",
    items,
    costThb: sumCost(items),
  };
}

function buildDepartureDay(dayNumber: number, date: string, input: ItineraryInput, used: Set<string>): ItineraryDay {
  const last = pick(input.city, ["coffee", "shopping"], used, 1)[0];
  const items: ItineraryItem[] = [
    {
      time: "08:30",
      title: "มื้อเช้า + เก็บกระเป๋า",
      detail: "เช็กเอาต์ส่วนใหญ่ก่อน 11:00 ฝากกระเป๋าไว้ที่โรงแรมได้ถ้าไฟลต์เย็น",
      durationMinutes: 75,
      costThb: 300,
    },
  ];
  if (last) items.push(toItem(last, "10:15"));
  items.push({
    time: "13:00",
    title: "เดินทางไปสนามบิน",
    detail: "เผื่อถึงสนามบินก่อนเครื่องออก 3 ชั่วโมงสำหรับไฟลต์ระหว่างประเทศ",
    durationMinutes: 90,
    costThb: 600,
    highlight: true,
  });
  return {
    dayNumber,
    date,
    theme: "departure",
    title: THEME_TITLE.departure,
    summary: "เก็บของให้เรียบร้อยแต่เช้า แล้วเผื่อเวลาไปสนามบินให้พอ",
    items,
    costThb: sumCost(items),
  };
}

/**
 * ตรวจปัญหาตารางเวลา (STEP 20)
 * ตอนนี้ตรวจ 2 อย่างที่พลาดบ่อยที่สุดสำหรับทริปดูบอลจากไทย
 */
export function detectConflicts(days: ItineraryDay[], input: ItineraryInput) {
  const issues: string[] = [];
  const matchDay = days.find((day) => day.theme === "matchday");

  if (input.matchDate && !matchDay) {
    issues.push("วันแข่งไม่อยู่ในช่วงวันเดินทางที่เลือก — ปรับวันออกเดินทางหรือความยาวทริป");
  }

  if (matchDay) {
    const leave = matchDay.items.find((item) => item.title.startsWith("ออกจากโรงแรมไปสนาม"));
    if (leave && clockToMinutes(leave.time) < 7 * 60) {
      issues.push("ต้องออกจากโรงแรมก่อน 07:00 เพื่อให้ทันเกม — ลองหาที่พักใกล้สนามกว่านี้");
    }
    const before = days.find((day) => day.dayNumber === matchDay.dayNumber - 1);
    if (before?.theme === "arrival") {
      issues.push("ถึงอังกฤษก่อนวันแข่งแค่ 1 วัน เจ็ตแล็กยังหนัก — เพิ่มวันหรือเลื่อนไฟลต์ให้เร็วขึ้น");
    }
  }

  return issues;
}
