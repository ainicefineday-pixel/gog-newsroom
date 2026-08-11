// ตัวช่วยแปลงข้อมูลดิบให้เป็นโมเดล GOG (STEP 11, 12, 13, 73, 74)
// ---------------------------------------------------------------------------
// รวมงานที่ adapter ทุกเจ้าต้องทำเหมือนกันไว้ที่เดียว: ตั้ง id ของ GOG เอง
// แปลงเวลาเตะเป็นเวลาสนามกับเวลาไทย และเทียบชื่อทีมเข้าพจนานุกรม

import { TEAM_NAMES, normalizeName, resolveOfficialName, thaiTeamName, thaiTeamShortName } from "@/services/football/thai";
import type {
  DataQuality, FixtureState, GOGTeam, GOGVenue, ProviderId, ProviderIds,
} from "@/services/football/types";

/**
 * id ของ GOG สร้างจากชื่อทางการ ไม่ใช่ id ของผู้ให้บริการ (STEP 12)
 * ผู้ให้บริการคนละเจ้าจึงชี้มาที่ทีมเดียวกันได้เอง โดยไม่ต้องมีตารางแมปตั้งแต่วันแรก
 */
export function gogTeamId(name: string) {
  const official = resolveOfficialName(name) ?? name;
  return `gog_team_${normalizeName(official).replace(/[^a-z0-9]+/g, "_")}`;
}

export function gogVenueId(name: string) {
  return `gog_venue_${normalizeName(name).replace(/[^a-z0-9]+/g, "_")}`;
}

/** id แมตช์ผูกกับคู่ทีมและวันเตะ ทำให้ผู้ให้บริการต่างเจ้าชี้มาที่แมตช์เดียวกัน */
export function gogFixtureId(homeName: string, awayName: string, kickoffUtc: string) {
  const day = kickoffUtc.slice(0, 10);
  return `gog_fx_${day}_${gogTeamId(homeName).slice(9)}_${gogTeamId(awayName).slice(9)}`;
}

export function buildTeam(name: string, provider: ProviderId, providerId?: string, crest?: string | null): GOGTeam {
  const official = resolveOfficialName(name) ?? name;
  const record = TEAM_NAMES[official];
  const providerIds: ProviderIds = providerId ? { [provider]: providerId } : {};
  return {
    id: gogTeamId(name),
    providerIds,
    name: official,
    nameTh: thaiTeamName(name),
    shortName: thaiTeamShortName(name),
    crest: crest ?? null,
    aliases: record ? record.aliases : [],
  };
}

export function buildVenue(
  name: string | null | undefined,
  city: string | null | undefined,
  capacity: number | null = null,
): GOGVenue | null {
  if (!name) return null;
  return {
    id: gogVenueId(name),
    providerIds: {},
    name,
    city: city ?? "",
    country: "England",
    capacity,
    // สนามพรีเมียร์ลีกอยู่อังกฤษทั้งหมด ใช้โซนเดียวได้ และรองรับ BST เองอัตโนมัติ
    timezone: "Europe/London",
  };
}

/** เวลาเตะตามเวลาสนามและเวลาไทย — คำนวณจาก UTC ด้วย Intl เสมอ (STEP 73, 74) */
export function kickoffTimes(kickoffUtc: string, timezone = "Europe/London") {
  const date = new Date(kickoffUtc);
  const clock = (tz: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  return { kickoffLocal: clock(timezone), kickoffBangkok: clock("Asia/Bangkok") };
}

/** วันที่แบบไทยเต็ม เช่น เสาร์ 14 มีนาคม 2027 (STEP 74) */
export function thaiFullDate(kickoffUtc: string, timezone = "Asia/Bangkok") {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(kickoffUtc));
}

export function thaiShortDate(kickoffUtc: string, timezone = "Asia/Bangkok") {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: timezone, weekday: "short", day: "numeric", month: "short",
  }).format(new Date(kickoffUtc));
}

/**
 * แปลงรหัสสถานะของผู้ให้บริการเป็นสถานะกลาง
 * รหัสที่ไม่รู้จักคืน unknown ไม่ใช่เดาว่าเป็น pre — เดาผิดแล้วหน้าเว็บโกหกผู้ใช้
 */
export function toFixtureState(code: string | null | undefined): FixtureState {
  const value = (code ?? "").toUpperCase();
  if (["NS", "TBD", "SCHEDULED", "TIMED"].includes(value)) return "pre";
  if (["1H", "2H", "ET", "P", "LIVE", "IN_PLAY"].includes(value)) return "live";
  if (["HT", "PAUSED"].includes(value)) return "half_time";
  if (["FT", "AET", "PEN", "FINISHED"].includes(value)) return "full_time";
  if (["PST", "POSTPONED"].includes(value)) return "postponed";
  if (["CANC", "CANCELLED"].includes(value)) return "cancelled";
  if (["ABD", "SUSP", "AWD", "WO"].includes(value)) return "abandoned";
  return "unknown";
}

export function quality(
  source: ProviderId,
  options: { delayed?: boolean; stale?: boolean; live?: boolean; retrievedAt?: string } = {},
): DataQuality {
  return {
    source,
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    isLive: options.live ?? false,
    isDelayed: options.delayed ?? false,
    stale: options.stale ?? false,
  };
}

/** ตัวเลขจากผู้ให้บริการ — ค่าที่หายไปต้องเป็น null ไม่ใช่ 0 (STEP 115) */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value.replace("%", "")) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
