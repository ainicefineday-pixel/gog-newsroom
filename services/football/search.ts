// ค้นหารวมของ Match Center (STEP 70)
// ---------------------------------------------------------------------------
// พิมพ์ไทยหรืออังกฤษก็เจอเหมือนกัน เพราะเทียบผ่าน alias ในพจนานุกรมชื่อทีม
// เช่น "แมนยู" · "Man Utd" · "Manchester United" ชี้มาที่ทีมเดียวกันหมด
//
// ค้นในสิ่งที่มีจริงเท่านั้น: แมตช์ ทีม และสนามที่มีคู่มือของ GOG แล้ว
// ผู้เล่นยังไม่รวม เพราะแพ็กข้อมูลฟรีไม่ได้ให้รายชื่อผู้เล่นมาครบทั้งลีก

import { GOG_STADIUMS } from "@/config/gog-stadiums";
import { TEAM_NAMES, normalizeName, thaiTeamName } from "@/services/football/thai";
import { thaiShortDate } from "@/services/football/normalize";
import type { GOGFixture } from "@/services/football/types";

export type SearchHit =
  | { kind: "fixture"; id: string; title: string; subtitle: string; fixtureId: string }
  | { kind: "team"; id: string; title: string; subtitle: string; teamName: string }
  | { kind: "stadium"; id: string; title: string; subtitle: string; stadium: string };

/** คำค้นตรงกับข้อความไหนบ้าง — เทียบแบบ normalize แล้วทั้งคู่ */
function matches(haystack: string[], needle: string) {
  const query = normalizeName(needle);
  if (query.length < 2) return false;
  return haystack.some((value) => normalizeName(value).includes(query));
}

export function searchFootball(query: string, fixtures: GOGFixture[], limit = 12): SearchHit[] {
  if (normalizeName(query).length < 2) return [];
  const hits: SearchHit[] = [];

  // ── ทีม ────────────────────────────────────────────────────────────────
  for (const [official, record] of Object.entries(TEAM_NAMES)) {
    if (!matches([official, record.th, record.short, ...record.aliases], query)) continue;
    const teamFixtures = fixtures.filter((item) => item.home.name === official || item.away.name === official);
    hits.push({
      kind: "team",
      id: `team_${official}`,
      title: record.th,
      subtitle: `${official} · มี ${teamFixtures.length} นัดในโปรแกรม`,
      teamName: official,
    });
  }

  // ── สนาม (เฉพาะที่มีคู่มือของ GOG แล้ว) ────────────────────────────────
  for (const stadium of GOG_STADIUMS) {
    if (!matches([stadium.stadium, stadium.city, stadium.club, thaiTeamName(stadium.club)], query)) continue;
    hits.push({
      kind: "stadium",
      id: `stadium_${stadium.stadium}`,
      title: stadium.stadium,
      subtitle: `${stadium.city} · ${thaiTeamName(stadium.club)} · ความจุ ${stadium.capacity.toLocaleString("th-TH")}`,
      stadium: stadium.stadium,
    });
  }

  // ── แมตช์ ──────────────────────────────────────────────────────────────
  for (const fixture of fixtures) {
    const haystack = [
      fixture.home.name, fixture.home.nameTh, fixture.home.shortName,
      fixture.away.name, fixture.away.nameTh, fixture.away.shortName,
      fixture.venue?.name ?? "", fixture.venue?.city ?? "",
    ];
    if (!matches(haystack, query)) continue;
    hits.push({
      kind: "fixture",
      id: `fixture_${fixture.id}`,
      title: `${fixture.home.nameTh} พบ ${fixture.away.nameTh}`,
      subtitle: `${thaiShortDate(fixture.kickoffUtc)} · ${fixture.kickoffBangkok} น. · ${fixture.venue?.name ?? ""}`,
      fixtureId: fixture.id,
    });
  }

  // เรียงให้ทีมและสนามขึ้นก่อน เพราะเป็นผลลัพธ์ที่กว้างกว่าและมักเป็นสิ่งที่ตั้งใจหา
  const order: Record<SearchHit["kind"], number> = { team: 0, stadium: 1, fixture: 2 };
  return hits.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, limit);
}

export const SEARCH_KIND_LABEL: Record<SearchHit["kind"], string> = {
  team: "สโมสร",
  stadium: "สนาม",
  fixture: "แมตช์",
};
