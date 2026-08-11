// อะแดปเตอร์ football-data.org (STEP 5)
// ---------------------------------------------------------------------------
// ใช้เป็นตัวสำรองของปฏิทินโปรแกรมแข่งและตารางคะแนน
// ฟีดฟรีของเจ้านี้ดีเลย์ ทุกผลลัพธ์จึงตั้ง delayed = true เสมอ ห้ามติดป้ายว่าสด
// ไม่รองรับ events/lineups/statistics ในแพ็กฟรี จึงประกาศ capabilities ไว้ตามจริง

import { buildTeam, buildVenue, gogFixtureId, kickoffTimes, quality, toFixtureState } from "@/services/football/normalize";
import { thaiTeamName } from "@/services/football/thai";
import type { GOGFixture, GOGStanding } from "@/services/football/types";
import type { FixtureQuery, FootballProvider, ProviderFetchResult } from "@/services/football/providers/types";

const BASE_URL = "https://api.football-data.org/v4";

export function createFootballDataProvider(apiKey: string | undefined, fetchImpl: typeof fetch = fetch): FootballProvider {
  const configured = Boolean(apiKey);

  async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetchImpl(url.toString(), {
      headers: { "X-Auth-Token": apiKey ?? "" },
      cf: { cacheTtl: 900, cacheEverything: true },
    } as RequestInit);
    if (response.status === 429) throw new Error("football_data_quota_exceeded");
    if (!response.ok) throw new Error(`football_data_http_${response.status}`);
    return await response.json() as T;
  }

  const result = <T>(data: T): ProviderFetchResult<T> => ({
    data, provider: "football_data", retrievedAt: new Date().toISOString(), stale: false, delayed: true,
  });

  type Row = {
    id?: number; utcDate?: string; status?: string; matchday?: number | null;
    competition?: { id?: number; name?: string };
    season?: { startDate?: string; endDate?: string };
    homeTeam?: { id?: number; name?: string; crest?: string };
    awayTeam?: { id?: number; name?: string; crest?: string };
    score?: { fullTime?: { home?: number | null; away?: number | null } };
    venue?: string | null;
  };

  function toFixture(row: Row): GOGFixture | null {
    const kickoffUtc = row.utcDate;
    const homeName = row.homeTeam?.name;
    const awayName = row.awayTeam?.name;
    if (!kickoffUtc || !homeName || !awayName) return null;
    const state = toFixtureState(row.status);
    return {
      id: gogFixtureId(homeName, awayName, kickoffUtc),
      providerIds: { football_data: String(row.id ?? "") },
      competitionId: String(row.competition?.id ?? ""),
      competitionName: row.competition?.name ?? "",
      season: (row.season?.startDate ?? "").slice(0, 4),
      matchweek: row.matchday ?? null,
      kickoffUtc,
      ...kickoffTimes(kickoffUtc),
      state,
      minute: null,
      home: buildTeam(homeName, "football_data", String(row.homeTeam?.id ?? ""), row.homeTeam?.crest ?? null),
      away: buildTeam(awayName, "football_data", String(row.awayTeam?.id ?? ""), row.awayTeam?.crest ?? null),
      homeScore: row.score?.fullTime?.home ?? null,
      awayScore: row.score?.fullTime?.away ?? null,
      venue: buildVenue(row.venue, null),
      scheduleConfirmed: state === "full_time",
      lastVerifiedAt: new Date().toISOString(),
      quality: quality("football_data", { delayed: true }),
    };
  }

  return {
    id: "football_data",
    label: "football-data.org",
    capabilities: {
      fixtures: true, fixtureDetail: true, events: false, lineups: false,
      teamStats: false, playerStats: false, headToHead: false, standings: true,
    },
    isConfigured: () => configured,

    async getFixtures(query: FixtureQuery) {
      const params: Record<string, string> = { season: query.season };
      if (query.from) params.dateFrom = query.from;
      if (query.to) params.dateTo = query.to;
      const payload = await call<{ matches?: Row[] }>(`/competitions/${query.competition}/matches`, params);
      const fixtures = (payload.matches ?? []).map(toFixture).filter((item): item is GOGFixture => item !== null);
      return result(fixtures);
    },

    async getFixture(fixtureId: string) {
      const payload = await call<{ match?: Row } & Row>(`/matches/${fixtureId}`);
      const fixture = toFixture(payload.match ?? payload);
      if (!fixture) throw new Error("fixture_not_found");
      return result(fixture);
    },

    async getStandings(competition: string, season: string) {
      const payload = await call<{
        standings?: Array<{ type?: string; table?: Array<{
          position?: number; team?: { id?: number; name?: string };
          playedGames?: number; won?: number; draw?: number; lost?: number;
          goalsFor?: number; goalsAgainst?: number; goalDifference?: number; points?: number; form?: string;
        }> }>;
      }>(`/competitions/${competition}/standings`, { season });
      const table = payload.standings?.find((entry) => entry.type === "TOTAL")?.table ?? [];
      const standings: GOGStanding[] = table.map((row) => ({
        position: row.position ?? 0,
        teamId: buildTeam(row.team?.name ?? "", "football_data").id,
        teamName: row.team?.name ?? "",
        teamNameTh: thaiTeamName(row.team?.name ?? ""),
        played: row.playedGames ?? 0,
        won: row.won ?? 0,
        drawn: row.draw ?? 0,
        lost: row.lost ?? 0,
        goalsFor: row.goalsFor ?? 0,
        goalsAgainst: row.goalsAgainst ?? 0,
        goalDifference: row.goalDifference ?? 0,
        points: row.points ?? 0,
        form: (row.form ?? "").split(",").map((value) => value.trim())
          .filter((value): value is "W" | "D" | "L" => ["W", "D", "L"].includes(value)),
      }));
      return result(standings);
    },
  };
}
