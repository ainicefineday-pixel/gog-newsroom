// อะแดปเตอร์ API-Football (STEP 4, 8, 82)
// ---------------------------------------------------------------------------
// ผู้ให้บริการหลักของ Match Center — รองรับครบที่สุดในบรรดาเจ้าฟรี
// คีย์อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น เบราว์เซอร์ห้ามยิงตรงเด็ดขาด (STEP 8)
//
// ข้อควรระวัง: บัญชีฟรีไม่ได้เปิดทุก endpoint และไม่ได้มีทุกฤดูกาล
// โค้ดจึงต้องอ่านจากสิ่งที่ตอบกลับมาจริง ไม่ใช่สมมติว่ามีครบ (STEP 4)

import {
  buildTeam, buildVenue, gogFixtureId, kickoffTimes, numberOrNull, quality, toFixtureState,
} from "@/services/football/normalize";
import type {
  GOGEvent, GOGEventType, GOGFixture, GOGHeadToHead, GOGLineup, GOGLineupPlayer,
  GOGStanding, GOGTeamStats,
} from "@/services/football/types";
import type { FixtureQuery, FootballProvider, ProviderFetchResult } from "@/services/football/providers/types";
import { thaiTeamName } from "@/services/football/thai";

const BASE_URL = "https://v3.football.api-sports.io";

type ApiTeam = { id?: number; name?: string; logo?: string };
type ApiFixtureRow = {
  fixture?: {
    id?: number; date?: string; status?: { short?: string; elapsed?: number | null };
    venue?: { name?: string | null; city?: string | null };
  };
  league?: { id?: number; name?: string; season?: number; round?: string };
  teams?: { home?: ApiTeam; away?: ApiTeam };
  goals?: { home?: number | null; away?: number | null };
};

/** ดึงเลขนัดจากข้อความ round เช่น "Regular Season - 12" */
function matchweekFrom(round: string | undefined): number | null {
  const found = /(\d+)\s*$/.exec(round ?? "");
  return found ? Number(found[1]) : null;
}

const EVENT_TYPE_MAP: Record<string, GOGEventType> = {
  "goal|normal goal": "goal",
  "goal|own goal": "own_goal",
  "goal|penalty": "penalty",
  "goal|missed penalty": "penalty_miss",
  "card|yellow card": "yellow_card",
  "card|red card": "red_card",
  "card|second yellow card": "second_yellow",
  "subst|substitution": "substitution",
  "var|goal cancelled": "var",
  "var|penalty confirmed": "var",
};

function toEventType(type: string, detail: string): GOGEventType | null {
  const key = `${type.toLowerCase()}|${detail.toLowerCase()}`;
  if (EVENT_TYPE_MAP[key]) return EVENT_TYPE_MAP[key];
  // detail แตกแขนงเยอะ (เช่น "Substitution 1") จึงถอยมาดูแค่ประเภทหลัก
  if (type.toLowerCase() === "subst") return "substitution";
  if (type.toLowerCase() === "var") return "var";
  if (type.toLowerCase() === "goal") return "goal";
  return null;
}

export function createApiFootballProvider(apiKey: string | undefined, fetchImpl: typeof fetch = fetch): FootballProvider {
  const configured = Boolean(apiKey);

  async function call<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetchImpl(url.toString(), {
      headers: { "x-apisports-key": apiKey ?? "" },
      // แคชฝั่ง Cloudflare 10 นาที กันยิงซ้ำจากหลายผู้ใช้พร้อมกัน (STEP 9)
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (response.status === 429) throw new Error("api_football_quota_exceeded");
    if (!response.ok) throw new Error(`api_football_http_${response.status}`);
    const payload = await response.json() as { response?: T; errors?: unknown };
    // API-Football ตอบ 200 พร้อม errors เป็นออบเจ็กต์เมื่อคีย์ผิดหรือโควตาหมด
    if (payload.errors && !Array.isArray(payload.errors) && Object.keys(payload.errors).length > 0) {
      throw new Error(`api_football_error_${JSON.stringify(payload.errors).slice(0, 120)}`);
    }
    return (payload.response ?? ([] as unknown)) as T;
  }

  function toFixture(row: ApiFixtureRow): GOGFixture | null {
    const kickoffUtc = row.fixture?.date;
    const homeName = row.teams?.home?.name;
    const awayName = row.teams?.away?.name;
    if (!kickoffUtc || !homeName || !awayName) return null;

    const state = toFixtureState(row.fixture?.status?.short);
    const times = kickoffTimes(kickoffUtc);
    return {
      id: gogFixtureId(homeName, awayName, kickoffUtc),
      providerIds: { api_football: String(row.fixture?.id ?? "") },
      competitionId: String(row.league?.id ?? ""),
      competitionName: row.league?.name ?? "",
      season: String(row.league?.season ?? ""),
      matchweek: matchweekFrom(row.league?.round),
      kickoffUtc,
      ...times,
      // API-Football ส่งเวลาเตะจริงเสมอ ไม่มีค่าแทนแบบ football-data.org
      kickoffTimeAnnounced: true,
      state,
      minute: row.fixture?.status?.elapsed ?? null,
      home: buildTeam(homeName, "api_football", String(row.teams?.home?.id ?? ""), row.teams?.home?.logo ?? null),
      away: buildTeam(awayName, "api_football", String(row.teams?.away?.id ?? ""), row.teams?.away?.logo ?? null),
      homeScore: row.goals?.home ?? null,
      awayScore: row.goals?.away ?? null,
      venue: buildVenue(row.fixture?.venue?.name, row.fixture?.venue?.city),
      // ผู้ให้บริการไม่บอกว่าตารางนิ่งหรือยัง ถือว่ายืนยันแล้วเมื่อแข่งจบ
      scheduleConfirmed: state === "full_time",
      lastVerifiedAt: new Date().toISOString(),
      quality: quality("api_football", { live: state === "live" || state === "half_time" }),
    };
  }

  const result = <T>(data: T, live = false): ProviderFetchResult<T> => ({
    data, provider: "api_football", retrievedAt: new Date().toISOString(), stale: false, delayed: !live,
  });

  return {
    id: "api_football",
    label: "API-Football",
    capabilities: {
      fixtures: true, fixtureDetail: true, events: true, lineups: true,
      teamStats: true, playerStats: true, headToHead: true, standings: true,
    },
    isConfigured: () => configured,

    async getFixtures(query: FixtureQuery) {
      const params: Record<string, string> = { league: query.competition, season: query.season };
      if (query.from) params.from = query.from;
      if (query.to) params.to = query.to;
      const rows = await call<ApiFixtureRow[]>("/fixtures", params);
      const fixtures = rows.map(toFixture).filter((item): item is GOGFixture => item !== null);
      return result(fixtures);
    },

    async getFixture(fixtureId: string) {
      const rows = await call<ApiFixtureRow[]>("/fixtures", { id: fixtureId });
      const fixture = rows.map(toFixture).find((item): item is GOGFixture => item !== null);
      if (!fixture) throw new Error("fixture_not_found");
      return result(fixture, fixture.state === "live");
    },

    async getEvents(fixtureId: string) {
      type Row = {
        time?: { elapsed?: number; extra?: number | null };
        team?: ApiTeam; player?: { name?: string }; assist?: { name?: string | null };
        type?: string; detail?: string;
      };
      const rows = await call<Row[]>("/fixtures/events", { fixture: fixtureId });
      const events: GOGEvent[] = [];
      rows.forEach((row, index) => {
        const type = toEventType(row.type ?? "", row.detail ?? "");
        if (!type || row.time?.elapsed === undefined) return;
        events.push({
          id: `${fixtureId}_${index}`,
          minute: row.time.elapsed,
          extraMinute: row.time.extra ?? null,
          teamId: buildTeam(row.team?.name ?? "", "api_football").id,
          type,
          playerName: row.player?.name ?? "",
          // ไม่มีคนจ่ายก็ต้องเป็น null ห้ามเดา (STEP 36)
          relatedPlayerName: row.assist?.name ?? null,
          homeScoreAfter: null,
          awayScoreAfter: null,
          detail: row.detail ?? "",
        });
      });
      return result(events.sort((a, b) => a.minute - b.minute));
    },

    async getLineups(fixtureId: string) {
      type Player = { player?: { number?: number; name?: string; pos?: string; grid?: string | null } };
      type Row = {
        team?: ApiTeam; formation?: string | null; coach?: { name?: string };
        startXI?: Player[]; substitutes?: Player[];
      };
      const rows = await call<Row[]>("/fixtures/lineups", { fixture: fixtureId });
      const toPlayer = (entry: Player): GOGLineupPlayer => {
        // grid มาเป็น "แถว:คอลัมน์" เช่น "3:2" — แปลงเป็นพิกัด 0–100 ให้วาดผังได้
        const [row, column] = (entry.player?.grid ?? "").split(":").map(Number);
        return {
          number: entry.player?.number ?? null,
          name: entry.player?.name ?? "",
          position: entry.player?.pos ?? null,
          gridX: Number.isFinite(row) ? row : null,
          gridY: Number.isFinite(column) ? column : null,
          captain: false,
        };
      };
      const lineups: GOGLineup[] = rows.map((row) => ({
        teamId: buildTeam(row.team?.name ?? "", "api_football").id,
        formation: row.formation ?? null,
        status: (row.startXI?.length ?? 0) > 0 ? "confirmed" : "unavailable",
        coach: row.coach?.name ?? null,
        startXI: (row.startXI ?? []).map(toPlayer),
        bench: (row.substitutes ?? []).map(toPlayer),
      }));
      return result(lineups);
    },

    async getTeamStats(fixtureId: string) {
      type Row = { team?: ApiTeam; statistics?: Array<{ type?: string; value?: unknown }> };
      const rows = await call<Row[]>("/fixtures/statistics", { fixture: fixtureId });
      const pick = (row: Row, label: string) =>
        numberOrNull(row.statistics?.find((item) => item.type === label)?.value);
      const stats: GOGTeamStats[] = rows.map((row) => ({
        teamId: buildTeam(row.team?.name ?? "", "api_football").id,
        possession: pick(row, "Ball Possession"),
        shots: pick(row, "Total Shots"),
        shotsOnTarget: pick(row, "Shots on Goal"),
        shotsOffTarget: pick(row, "Shots off Goal"),
        blockedShots: pick(row, "Blocked Shots"),
        corners: pick(row, "Corner Kicks"),
        fouls: pick(row, "Fouls"),
        offsides: pick(row, "Offsides"),
        saves: pick(row, "Goalkeeper Saves"),
        passes: pick(row, "Total passes"),
        passAccuracy: pick(row, "Passes %"),
        yellowCards: pick(row, "Yellow Cards"),
        redCards: pick(row, "Red Cards"),
      }));
      return result(stats);
    },

    async getHeadToHead(homeId: string, awayId: string) {
      const rows = await call<ApiFixtureRow[]>("/fixtures/headtohead", { h2h: `${homeId}-${awayId}`, last: "5" });
      const recent = rows
        .map(toFixture)
        .filter((item): item is GOGFixture => item !== null && item.homeScore !== null && item.awayScore !== null)
        .map((item) => ({
          kickoffUtc: item.kickoffUtc,
          homeName: item.home.name,
          awayName: item.away.name,
          homeScore: item.homeScore as number,
          awayScore: item.awayScore as number,
          competition: item.competitionName,
        }));
      const h2h: GOGHeadToHead = {
        played: recent.length,
        homeWins: recent.filter((item) => item.homeScore > item.awayScore).length,
        draws: recent.filter((item) => item.homeScore === item.awayScore).length,
        awayWins: recent.filter((item) => item.homeScore < item.awayScore).length,
        recent,
      };
      return result(h2h);
    },

    async getStandings(competition: string, season: string) {
      type Row = {
        rank?: number; team?: ApiTeam; points?: number; goalsDiff?: number;
        all?: { played?: number; win?: number; draw?: number; lose?: number; goals?: { for?: number; against?: number } };
        form?: string;
      };
      const groups = await call<Array<{ league?: { standings?: Row[][] } }>>("/standings", { league: competition, season });
      const table = groups[0]?.league?.standings?.[0] ?? [];
      const standings: GOGStanding[] = table.map((row) => ({
        position: row.rank ?? 0,
        teamId: buildTeam(row.team?.name ?? "", "api_football").id,
        teamName: row.team?.name ?? "",
        teamNameTh: thaiTeamName(row.team?.name ?? ""),
        played: row.all?.played ?? 0,
        won: row.all?.win ?? 0,
        drawn: row.all?.draw ?? 0,
        lost: row.all?.lose ?? 0,
        goalsFor: row.all?.goals?.for ?? 0,
        goalsAgainst: row.all?.goals?.against ?? 0,
        goalDifference: row.goalsDiff ?? 0,
        points: row.points ?? 0,
        form: (row.form ?? "").split("").filter((value): value is "W" | "D" | "L" => "WDL".includes(value)),
      }));
      return result(standings);
    },
  };
}
