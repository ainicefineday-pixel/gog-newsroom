// สัญญากลางของผู้ให้บริการข้อมูลฟุตบอล (STEP 82)
// ---------------------------------------------------------------------------
// แต่ละเจ้ารองรับไม่เท่ากัน adapter จึงประกาศ capabilities ของตัวเองไว้
// แล้ว router ค่อยเลือกว่าเรื่องไหนถามใคร ไม่ใช่เรียกไปแล้วค่อยลุ้นว่ามีข้อมูลไหม

import type {
  GOGEvent, GOGFixture, GOGHeadToHead, GOGLineup, GOGStanding, GOGTeamStats, ProviderId,
} from "@/services/football/types";

/** ผู้ให้บริการเจ้านี้ทำอะไรได้บ้าง — ใช้ตัดสินใจก่อนยิงจริง ประหยัดโควตา */
export type ProviderCapabilities = {
  fixtures: boolean;
  fixtureDetail: boolean;
  events: boolean;
  lineups: boolean;
  teamStats: boolean;
  playerStats: boolean;
  headToHead: boolean;
  standings: boolean;
};

export type ProviderFetchResult<T> = {
  data: T;
  provider: ProviderId;
  retrievedAt: string;
  /** ข้อมูลจากแคชที่เลยอายุแล้ว แต่ดึงใหม่ไม่ได้ จึงเสิร์ฟของเก่าไปก่อน (STEP 83) */
  stale: boolean;
  /** ฟีดฟรีหลายเจ้าดีเลย์ ห้ามติดป้ายว่าสด (STEP 5) */
  delayed: boolean;
};

export type FixtureQuery = {
  competition: string;
  season: string;
  /** ช่วงวันที่แบบ YYYY-MM-DD — ไม่ใส่คือทั้งฤดูกาล */
  from?: string;
  to?: string;
};

export interface FootballProvider {
  readonly id: ProviderId;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  /** พร้อมใช้งานไหม (มีคีย์ครบหรือยัง) — ไม่พร้อมก็ข้ามไปเจ้าถัดไป */
  isConfigured(): boolean;

  getFixtures?(query: FixtureQuery): Promise<ProviderFetchResult<GOGFixture[]>>;
  getFixture?(fixtureId: string): Promise<ProviderFetchResult<GOGFixture>>;
  getEvents?(fixtureId: string): Promise<ProviderFetchResult<GOGEvent[]>>;
  getLineups?(fixtureId: string): Promise<ProviderFetchResult<GOGLineup[]>>;
  getTeamStats?(fixtureId: string): Promise<ProviderFetchResult<GOGTeamStats[]>>;
  getHeadToHead?(homeId: string, awayId: string): Promise<ProviderFetchResult<GOGHeadToHead>>;
  getStandings?(competition: string, season: string): Promise<ProviderFetchResult<GOGStanding[]>>;
}

export const NO_CAPABILITIES: ProviderCapabilities = {
  fixtures: false,
  fixtureDetail: false,
  events: false,
  lineups: false,
  teamStats: false,
  playerStats: false,
  headToHead: false,
  standings: false,
};
