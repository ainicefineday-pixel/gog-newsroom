// โมเดลกลางของ GOG FOOTBALL MATCH CENTER (STEP 11, 12, 114, 115)
// ---------------------------------------------------------------------------
// UI ห้ามผูกกับรูปร่างข้อมูลของผู้ให้บริการรายใดรายหนึ่ง ทุกอย่างต้องแปลงมาเป็น
// โมเดลในไฟล์นี้ก่อน เปลี่ยนผู้ให้บริการทีหลังจึงไม่ต้องรื้อหน้าเว็บ
//
// กติกาเรื่องค่าว่างที่ต้องยึดให้ตรงกันทั้งระบบ (STEP 115):
//   null      = ไม่มีข้อมูล / ผู้ให้บริการไม่ส่งมา
//   0         = มีข้อมูลและค่าเป็นศูนย์จริง
// ห้ามแปลง null เป็น 0 เด็ดขาด เพราะสูตรคำนวณทั้งหมดต้องข้ามค่าที่ไม่มี ไม่ใช่คิดเป็นศูนย์

export type ProviderId = "api_football" | "football_data" | "thesportsdb" | "gog_demo";

/** ทุกเอนทิตีถือ id ของ GOG เอง แล้วเก็บ id ของผู้ให้บริการไว้ข้าง ๆ (STEP 12) */
export type ProviderIds = Partial<Record<ProviderId, string>>;

export type DataQuality = {
  source: ProviderId;
  retrievedAt: string;
  /** true = ข้อมูลสด · false = ดึงจากแคชหรือฟีดที่ดีเลย์ */
  isLive: boolean;
  isDelayed: boolean;
  /** ข้อมูลเก่ากว่าอายุที่กำหนดแต่ยังเสิร์ฟให้เพราะดึงใหม่ไม่ได้ (STEP 83) */
  stale: boolean;
};

export type GOGVenue = {
  id: string;
  providerIds: ProviderIds;
  name: string;
  city: string;
  country: string;
  capacity: number | null;
  /** โซนเวลาของสนาม ใช้แปลงเวลาเตะให้ถูกทุกฤดูกาล (STEP 73) */
  timezone: string;
};

export type GOGTeam = {
  id: string;
  providerIds: ProviderIds;
  name: string;
  /** ชื่อไทยที่ยืนยันแล้ว — ไม่ใช่คำแปลสด (STEP 28) */
  nameTh: string;
  shortName: string;
  crest: string | null;
  aliases: string[];
};

export type FixtureState =
  | "pre" | "live" | "half_time" | "full_time"
  | "postponed" | "cancelled" | "abandoned" | "unknown";

export type GOGFixture = {
  id: string;
  providerIds: ProviderIds;
  competitionId: string;
  competitionName: string;
  season: string;
  matchweek: number | null;
  kickoffUtc: string;
  /** เวลาเตะตามเวลาสนาม กับตามเวลาไทย — คำนวณด้วยโค้ดเสมอ ห้ามให้ AI คิด (STEP 74) */
  kickoffLocal: string;
  kickoffBangkok: string;
  state: FixtureState;
  /** นาทีที่แข่งอยู่ — มีเฉพาะตอน live */
  minute: number | null;
  home: GOGTeam;
  away: GOGTeam;
  homeScore: number | null;
  awayScore: number | null;
  venue: GOGVenue | null;
  /** ยืนยันวันเวลาแล้วหรือยัง — พรีเมียร์ลีกเลื่อนตามการถ่ายทอดสดบ่อย (STEP 66) */
  scheduleConfirmed: boolean;
  lastVerifiedAt: string;
  quality: DataQuality;
};

export type GOGEventType =
  | "goal" | "own_goal" | "penalty" | "penalty_miss"
  | "yellow_card" | "red_card" | "second_yellow"
  | "substitution" | "var";

export type GOGEvent = {
  id: string;
  minute: number;
  extraMinute: number | null;
  teamId: string;
  type: GOGEventType;
  playerName: string;
  /** ผู้จ่าย/ผู้เปลี่ยนตัวเข้า — null เมื่อผู้ให้บริการไม่ส่งมา ห้ามเดา (STEP 36) */
  relatedPlayerName: string | null;
  homeScoreAfter: number | null;
  awayScoreAfter: number | null;
  detail: string;
};

export type GOGLineupPlayer = {
  number: number | null;
  name: string;
  position: string | null;
  /** ตำแหน่งบนสนามแบบ 0–100 สำหรับวาดผังตัวจริง — null เมื่อไม่มีข้อมูลกริด */
  gridX: number | null;
  gridY: number | null;
  captain: boolean;
};

export type GOGLineup = {
  teamId: string;
  formation: string | null;
  /** ยืนยันแล้วหรือเป็นตัวคาดการณ์ ต้องแยกให้ชัด ห้ามเอาตัวคาดมาแสดงเป็นตัวจริง (STEP 33) */
  status: "confirmed" | "predicted" | "unavailable";
  coach: string | null;
  startXI: GOGLineupPlayer[];
  bench: GOGLineupPlayer[];
};

/** สถิติทีม — ทุกช่องเป็น null ได้ แปลว่าผู้ให้บริการไม่ส่งมา */
export type GOGTeamStats = {
  teamId: string;
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  blockedShots: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  saves: number | null;
  passes: number | null;
  passAccuracy: number | null;
  yellowCards: number | null;
  redCards: number | null;
};

export type GOGStanding = {
  position: number;
  teamId: string;
  teamName: string;
  teamNameTh: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Array<"W" | "D" | "L">;
};

export type GOGHeadToHead = {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  recent: Array<{
    kickoffUtc: string;
    homeName: string;
    awayName: string;
    homeScore: number;
    awayScore: number;
    competition: string;
  }>;
};

/**
 * ความสามารถของข้อมูลแมตช์นี้ (STEP 17)
 * UI ต้องเรนเดอร์ตามตารางนี้เท่านั้น ไม่มีข้อมูลก็ไม่ต้องมีช่องว่างเปล่าหรือของปลอม
 */
export type MatchCapabilities = {
  score: boolean;
  events: boolean;
  lineups: boolean;
  teamStats: boolean;
  playerStats: boolean;
  headToHead: boolean;
  standings: boolean;
  xg: boolean;
  shotCoordinates: boolean;
  tracking: boolean;
};

export const EMPTY_CAPABILITIES: MatchCapabilities = {
  score: false,
  events: false,
  lineups: false,
  teamStats: false,
  playerStats: false,
  headToHead: false,
  standings: false,
  xg: false,
  shotCoordinates: false,
  tracking: false,
};

/** ก้อนข้อมูลทั้งหมดของหน้าแมตช์ ประกอบจากหลายผู้ให้บริการแล้ว */
export type GOGMatchBundle = {
  fixture: GOGFixture;
  events: GOGEvent[];
  lineups: GOGLineup[];
  teamStats: GOGTeamStats[];
  headToHead: GOGHeadToHead | null;
  standings: GOGStanding[];
  capabilities: MatchCapabilities;
  /** เวลาที่ซิงก์แต่ละส่วนล่าสุด ใช้บอกผู้ใช้ว่าข้อมูลสดแค่ไหน (STEP 75) */
  sync: {
    fixture: string | null;
    events: string | null;
    stats: string | null;
    lineups: string | null;
  };
  /** true = ทั้งหน้าเป็นข้อมูลตัวอย่าง ต้องติดป้าย DEMO ให้ชัด (STEP 120) */
  demo: boolean;
};
