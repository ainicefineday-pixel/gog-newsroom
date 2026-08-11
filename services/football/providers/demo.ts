// โหมดสาธิตเมื่อยังไม่มี API key (STEP 120)
// ---------------------------------------------------------------------------
// ทุกอย่างที่ออกจากที่นี่ถือเป็น "ข้อมูลตัวอย่าง" หน้าเว็บต้องติดป้าย DEMO DATA เสมอ
// ห้ามทำให้ผลสาธิตดูเหมือนผลสด — สร้างมาเพื่อให้ประกอบ UI และทดสอบสถาปัตยกรรมได้
// ก่อนมีคีย์จริง พอใส่คีย์แล้ว router จะเลิกใช้เจ้านี้เองโดยไม่ต้องแก้ UI
//
// โปรแกรมแข่งยืมจาก config/mu-fixtures.ts ที่ทานกับโปรแกรมทางการแล้ว
// ส่วนสกอร์/สถิติ/ไลน์อัพเป็นตัวเลขสมมติทั้งหมด

import { MU_PREMIER_LEAGUE_FIXTURES } from "@/config/mu-fixtures";
import { buildTeam, buildVenue, gogFixtureId, kickoffTimes, quality } from "@/services/football/normalize";
import { TEAM_NAMES, thaiTeamName } from "@/services/football/thai";
import type {
  GOGEvent, GOGFixture, GOGHeadToHead, GOGLineup, GOGStanding, GOGTeamStats,
} from "@/services/football/types";
import type { FootballProvider, ProviderFetchResult } from "@/services/football/providers/types";

/** สุ่มแบบกำหนดผลได้จากสตริง — เปิดหน้าเดิมกี่ครั้งตัวเลขตัวอย่างก็เท่าเดิม */
function seeded(seed: string, min: number, max: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return min + (hash % Math.max(max - min + 1, 1));
}

function toDemoFixture(row: (typeof MU_PREMIER_LEAGUE_FIXTURES)[number], now: number): GOGFixture {
  const kickoffUtc = row.kickoffUtc;
  const started = new Date(kickoffUtc).getTime();
  const finished = now > started + 115 * 60_000;
  const live = now >= started && !finished;
  const id = gogFixtureId(row.home, row.away, kickoffUtc);

  return {
    id,
    providerIds: { gog_demo: id },
    competitionId: "PL",
    competitionName: "Premier League",
    season: "2026",
    matchweek: row.matchday,
    kickoffUtc,
    ...kickoffTimes(kickoffUtc),
    state: finished ? "full_time" : live ? "live" : "pre",
    minute: live ? Math.min(Math.floor((now - started) / 60_000), 90) : null,
    home: buildTeam(row.home, "gog_demo"),
    away: buildTeam(row.away, "gog_demo"),
    homeScore: finished || live ? seeded(`${id}h`, 0, 3) : null,
    awayScore: finished || live ? seeded(`${id}a`, 0, 3) : null,
    venue: buildVenue(row.stadium, row.city),
    scheduleConfirmed: row.status === "confirmed",
    lastVerifiedAt: new Date().toISOString(),
    quality: quality("gog_demo", { delayed: true }),
  };
}

export function createDemoProvider(now: () => number = Date.now): FootballProvider {
  const result = <T>(data: T): ProviderFetchResult<T> => ({
    data, provider: "gog_demo", retrievedAt: new Date().toISOString(), stale: false, delayed: true,
  });

  const allFixtures = () => MU_PREMIER_LEAGUE_FIXTURES.map((row) => toDemoFixture(row, now()));
  const findFixture = (fixtureId: string) => allFixtures().find((item) => item.id === fixtureId) ?? null;

  return {
    id: "gog_demo",
    label: "GOG Demo Data",
    capabilities: {
      fixtures: true, fixtureDetail: true, events: true, lineups: true,
      teamStats: true, playerStats: false, headToHead: true, standings: true,
    },
    isConfigured: () => true,

    async getFixtures() {
      return result(allFixtures());
    },

    async getFixture(fixtureId: string) {
      const fixture = findFixture(fixtureId);
      if (!fixture) throw new Error("fixture_not_found");
      return result(fixture);
    },

    async getEvents(fixtureId: string) {
      const fixture = findFixture(fixtureId);
      // ก่อนเริ่มแข่งยังไม่มีเหตุการณ์ — คืนลิสต์ว่าง ไม่ใช่แต่งขึ้นมา
      if (!fixture || fixture.state === "pre") return result([] as GOGEvent[]);
      const events: GOGEvent[] = [];
      const total = (fixture.homeScore ?? 0) + (fixture.awayScore ?? 0);
      for (let index = 0; index < total; index += 1) {
        const homeGoal = index < (fixture.homeScore ?? 0);
        events.push({
          id: `${fixtureId}_demo_${index}`,
          minute: seeded(`${fixtureId}m${index}`, 5, 88),
          extraMinute: null,
          teamId: homeGoal ? fixture.home.id : fixture.away.id,
          type: "goal",
          playerName: "ตัวอย่างผู้ทำประตู",
          relatedPlayerName: null,
          homeScoreAfter: null,
          awayScoreAfter: null,
          detail: "ข้อมูลตัวอย่าง",
        });
      }
      events.push({
        id: `${fixtureId}_demo_card`,
        minute: seeded(`${fixtureId}card`, 20, 80),
        extraMinute: null,
        teamId: fixture.away.id,
        type: "yellow_card",
        playerName: "ตัวอย่างผู้เล่น",
        relatedPlayerName: null,
        homeScoreAfter: null,
        awayScoreAfter: null,
        detail: "ข้อมูลตัวอย่าง",
      });
      return result(events.sort((a, b) => a.minute - b.minute));
    },

    async getLineups(fixtureId: string) {
      const fixture = findFixture(fixtureId);
      // โหมดสาธิตไม่แต่งตัวจริง — ไลน์อัพจริงประกาศราว 1 ชั่วโมงก่อนเตะเท่านั้น
      if (!fixture) return result([] as GOGLineup[]);
      return result([
        { teamId: fixture.home.id, formation: null, status: "unavailable", coach: null, startXI: [], bench: [] },
        { teamId: fixture.away.id, formation: null, status: "unavailable", coach: null, startXI: [], bench: [] },
      ] as GOGLineup[]);
    },

    async getTeamStats(fixtureId: string) {
      const fixture = findFixture(fixtureId);
      if (!fixture || fixture.state === "pre") return result([] as GOGTeamStats[]);
      const build = (teamId: string, seed: string): GOGTeamStats => {
        const possession = seeded(`${seed}pos`, 38, 62);
        return {
          teamId,
          possession,
          shots: seeded(`${seed}sh`, 6, 20),
          shotsOnTarget: seeded(`${seed}sot`, 2, 8),
          shotsOffTarget: seeded(`${seed}soff`, 2, 9),
          blockedShots: seeded(`${seed}blk`, 0, 5),
          corners: seeded(`${seed}cor`, 2, 11),
          fouls: seeded(`${seed}foul`, 6, 16),
          offsides: seeded(`${seed}off`, 0, 5),
          saves: seeded(`${seed}sav`, 1, 7),
          passes: seeded(`${seed}pass`, 320, 640),
          passAccuracy: seeded(`${seed}acc`, 74, 92),
          yellowCards: seeded(`${seed}yc`, 0, 4),
          redCards: 0,
        };
      };
      return result([
        build(fixture.home.id, `${fixtureId}home`),
        build(fixture.away.id, `${fixtureId}away`),
      ]);
    },

    async getHeadToHead(homeId: string, awayId: string) {
      const seed = `${homeId}${awayId}`;
      const h2h: GOGHeadToHead = {
        played: 5,
        homeWins: seeded(`${seed}hw`, 1, 3),
        draws: seeded(`${seed}d`, 0, 2),
        awayWins: 0,
        recent: [],
      };
      h2h.awayWins = Math.max(5 - h2h.homeWins - h2h.draws, 0);
      return result(h2h);
    },

    async getStandings() {
      const names = Object.keys(TEAM_NAMES).slice(0, 20);
      const standings: GOGStanding[] = names.map((name, index) => {
        const played = 20;
        const won = Math.max(14 - index, 2);
        const drawn = seeded(`${name}d`, 1, 6);
        const lost = Math.max(played - won - drawn, 0);
        return {
          position: index + 1,
          teamId: buildTeam(name, "gog_demo").id,
          teamName: name,
          teamNameTh: thaiTeamName(name),
          played,
          won,
          drawn,
          lost,
          goalsFor: won * 2 + drawn,
          goalsAgainst: lost * 2 + drawn,
          goalDifference: won * 2 + drawn - (lost * 2 + drawn),
          points: won * 3 + drawn,
          form: [],
        };
      });
      return result(standings);
    },
  };
}
