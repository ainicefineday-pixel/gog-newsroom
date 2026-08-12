// พยากรณ์อากาศวันแข่ง — Open-Meteo
// ฟรีสนิท ไม่ต้องใช้ API key และไม่จำกัดจำนวนคำขอสำหรับการใช้งานทั่วไป
// จึงเรียกจาก Cloudflare Worker ได้โดยไม่ต้องเก็บ secret เพิ่ม

export type MatchWeather = {
  date: string;
  maxC: number;
  minC: number;
  rainChance: number;
  windKph: number;
  code: number;
  summary: string;
  advice: string;
};

// พิกัดสนามที่ระบบรองรับตอนนี้
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  Manchester: { lat: 53.4631, lon: -2.2913 },   // Old Trafford
  London: { lat: 51.5074, lon: -0.1278 },
};

// รหัสสภาพอากาศของ WMO ที่ Open-Meteo ใช้ — แปลเฉพาะกลุ่มที่เจอบ่อยในอังกฤษ
function describe(code: number) {
  if (code === 0) return "ฟ้าโปร่ง";
  if (code <= 3) return "มีเมฆบางส่วน";
  if (code <= 48) return "หมอก";
  if (code <= 57) return "ฝนละออง";
  if (code <= 67) return "ฝนตก";
  if (code <= 77) return "หิมะ";
  if (code <= 82) return "ฝนซู่";
  if (code <= 86) return "หิมะซู่";
  return "พายุฝนฟ้าคะนอง";
}

function adviceFor(maxC: number, rainChance: number, windKph: number) {
  const tips: string[] = [];
  if (maxC <= 6) tips.push("หนาวจัด ใส่เสื้อกันหนาวหนา ๆ ถุงมือและหมวก — นั่งบนอัฒจันทร์ 2 ชั่วโมงหนาวกว่าที่คิด");
  else if (maxC <= 12) tips.push("อากาศเย็น ใส่เสื้อคลุมกันลมไปด้วย");
  if (rainChance >= 50) tips.push("ฝนมีโอกาสตกสูง เอาเสื้อกันฝนแบบมีฮู้ดไป — สนามส่วนใหญ่ไม่ให้เอาร่มเข้า");
  else if (rainChance >= 25) tips.push("มีโอกาสฝนปรอย พกเสื้อกันฝนบาง ๆ ติดตัว");
  if (windKph >= 35) tips.push("ลมแรง ระวังหมวกปลิวและอากาศจะรู้สึกเย็นกว่าตัวเลขจริง");
  return tips.join(" · ") || "อากาศกำลังดีสำหรับดูบอล";
}

/**
 * ขอพยากรณ์ของวันแข่ง — คืน null ถ้าวันนั้นไกลเกินช่วงพยากรณ์ (ประมาณ 16 วัน)
 * ไม่ throw เพื่อไม่ให้หน้าเว็บพังเพราะบริการอากาศล่ม
 */
export async function fetchMatchWeather(city: string, date: string): Promise<MatchWeather | null> {
  const coords = CITY_COORDS[city];
  if (!coords || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    timezone: "Europe/London",
    start_date: date,
    end_date: date,
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      daily?: {
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
        wind_speed_10m_max?: number[];
      };
    };
    const daily = payload.daily;
    if (!daily?.temperature_2m_max?.length) return null;
    const maxC = Math.round(daily.temperature_2m_max[0]);
    const minC = Math.round(daily.temperature_2m_min?.[0] ?? maxC);
    const rainChance = Math.round(daily.precipitation_probability_max?.[0] ?? 0);
    const windKph = Math.round(daily.wind_speed_10m_max?.[0] ?? 0);
    const code = daily.weather_code?.[0] ?? 0;
    return {
      date,
      maxC,
      minC,
      rainChance,
      windKph,
      code,
      summary: describe(code),
      advice: adviceFor(maxC, rainChance, windKph),
    };
  } catch {
    return null;
  }
}

// ── สภาพอากาศสดที่สนาม ─────────────────────────────────────────────────────
// ต่างจาก fetchMatchWeather ข้างบนที่เป็น "พยากรณ์ของทั้งวัน" สำหรับวางแผนทริป
// อันนี้คือ "ตอนนี้ที่สนามเป็นยังไง" สำหรับแถบบน nav จึงขอค่าปัจจุบันล้วน ๆ
//
// ค่าฝุ่นมาจาก Open-Meteo คนละโฮสต์กับพยากรณ์อากาศ (air-quality-api) จึงต้องยิงสองครั้ง
// ยิงพร้อมกันและแยกกันล้ม ถ้าฝั่งฝุ่นล่มยังได้อุณหภูมิกับลม ดีกว่าไม่ได้อะไรเลย

export type VenueConditions = {
  temperatureC: number;
  feelsLikeC: number;
  windKph: number;
  humidity: number;
  code: number;
  summary: string;
  isDay: boolean;
  /** PM2.5 ไมโครกรัม/ลบ.ม. — null เมื่อบริการค่าฝุ่นไม่ตอบ */
  pm25: number | null;
  pm10: number | null;
  /** คำอธิบายคุณภาพอากาศแบบไทย อิงเกณฑ์ PM2.5 24 ชม. ของกรมควบคุมมลพิษ */
  airLabel: string | null;
  observedAt: string;
};

/** เกณฑ์ PM2.5 ของไทย — 0-15 ดีมาก · 15.1-25 ดี · 25.1-37.5 ปานกลาง · 37.6-75 เริ่มมีผล · 75+ มีผล */
function describeAir(pm25: number) {
  if (pm25 <= 15) return "อากาศดีมาก";
  if (pm25 <= 25) return "อากาศดี";
  if (pm25 <= 37.5) return "ปานกลาง";
  if (pm25 <= 75) return "เริ่มมีผลต่อสุขภาพ";
  return "มีผลต่อสุขภาพ";
}

async function fetchAir(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "pm2_5,pm10",
  });
  try {
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { current?: { pm2_5?: number; pm10?: number } };
    if (typeof payload.current?.pm2_5 !== "number") return null;
    return { pm25: payload.current.pm2_5, pm10: payload.current.pm10 ?? null };
  } catch {
    return null;
  }
}

/** คืน null เมื่อขอสภาพอากาศไม่ได้เลย — แถบจะซ่อนส่วนอากาศ ไม่ใช่โชว์ขีดกลาง */
export async function fetchVenueConditions(latitude: number, longitude: number): Promise<VenueConditions | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    wind_speed_unit: "kmh",
  });

  const [weather, air] = await Promise.all([
    (async () => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) return null;
        return await response.json() as {
          current?: {
            time?: string;
            temperature_2m?: number;
            apparent_temperature?: number;
            relative_humidity_2m?: number;
            wind_speed_10m?: number;
            weather_code?: number;
            is_day?: number;
          };
        };
      } catch {
        return null;
      }
    })(),
    fetchAir(latitude, longitude),
  ]);

  const current = weather?.current;
  if (typeof current?.temperature_2m !== "number") return null;
  const code = current.weather_code ?? 0;

  return {
    temperatureC: Math.round(current.temperature_2m),
    feelsLikeC: Math.round(current.apparent_temperature ?? current.temperature_2m),
    windKph: Math.round(current.wind_speed_10m ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    code,
    summary: describe(code),
    isDay: current.is_day !== 0,
    pm25: air ? Math.round(air.pm25 * 10) / 10 : null,
    pm10: air?.pm10 === null || air?.pm10 === undefined ? null : Math.round(air.pm10),
    airLabel: air ? describeAir(air.pm25) : null,
    observedAt: current.time ?? new Date().toISOString(),
  };
}
