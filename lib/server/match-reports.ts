// เผยแพร่รายงานผลบอลอัตโนมัติเมื่อจบเกม (STEP 45, 46)
// ---------------------------------------------------------------------------
// cron วิ่งทุก 10 นาทีอยู่แล้วเพื่อดึงข่าว งานนี้ต่อท้ายไปเลย:
//   หานัดที่เพิ่งจบ → ประกอบรายงานไทย → เขียนลงคลังข่าวเป็นข่าวหนึ่งชิ้น
//
// ข้อจำกัดที่ตั้งใจใส่ไว้:
//   - ดูย้อนหลังแค่ 2 วัน ไม่ไล่ทั้งฤดูกาล เพราะจะกินโควตาผู้ให้บริการจนหมด
//   - แต่ละรอบเผยแพร่ได้ไม่เกิน 3 นัด นัดที่เหลือรอรอบถัดไป (อีก 10 นาที)
//     วันเสาร์บ่ายมีจบพร้อมกันได้ถึง 5-6 นัด ถ้าดึง bundle ทีเดียวหมดจะโดน rate limit
//   - นัดที่เคยปล่อยแล้วข้ามทันทีโดยไม่ต้องดึง bundle เลย

import { getFixtures, getMatchBundle } from "@/lib/server/football";
import { upsertStory, type RuntimeEnv } from "@/lib/server/database";
import { buildMatchReport } from "@/services/intelligence/matchReport";
import { DEFAULT_COMPETITION_ID, DEFAULT_SEASON } from "@/services/football/competitions";
import type { Story } from "@/lib/types";

/** จบไปแล้วไม่เกินเท่านี้ถึงจะรายงาน — เก่ากว่านี้ถือว่าตกข่าว ไม่ต้องปล่อยย้อนหลัง */
const LOOKBACK_HOURS = 48;
/** จำกัดจำนวนนัดต่อรอบ เพื่อไม่ให้ยิงผู้ให้บริการรัวจนโดนตัด */
const MAX_PER_RUN = 3;

async function publishedFixtureIds(db: D1Database) {
  const rows = await db.prepare("SELECT fixture_id FROM football_match_reports").all<{ fixture_id: string }>();
  return new Set((rows.results ?? []).map((row) => row.fixture_id));
}

/**
 * ข่าวที่ระบบเขียนเอง ต้องแยกออกจากข่าวที่แปลจากสำนักข่าวให้ชัด
 * credibility 100 เพราะเป็นผลการแข่งขันที่ตรวจสอบได้ ไม่ใช่ข่าวลือ
 * verified true เพราะมาจากผู้ให้บริการข้อมูลที่ยืนยันแล้ว ไม่ใช่การอ้างแหล่งเดียว
 */
function toStory(report: ReturnType<typeof buildMatchReport> & object, fixtureUrl: string): Story {
  return {
    id: report.storyId,
    date: report.publishedAt.slice(0, 10),
    category: "Match/Preview",
    credibility: 100,
    titleEn: report.titleEn,
    excerptEn: "",
    articleEn: "",
    titleTh: report.titleTh,
    summaryTh: report.summaryTh,
    contentTh: report.contentTh,
    // แปลแล้ว = true เพราะเขียนเป็นไทยตั้งแต่ต้น ไม่ต้องส่งไปให้โมเดลแปลอีก
    translated: true,
    sources: [{
      name: "GOG MATCH ENGINE",
      url: fixtureUrl,
      domain: "gog-newsroom.geniusontheground.workers.dev",
      tier: 1,
      publishedAt: report.publishedAt,
    }],
    url: fixtureUrl,
    publishedAt: report.publishedAt,
    verified: true,
    angles: [],
    topicTerms: [],
  };
}

export type MatchReportRun = {
  checked: number;
  published: string[];
  skipped: number;
};

export async function publishFinishedMatchReports(env: RuntimeEnv): Promise<MatchReportRun> {
  if (!env.DB) return { checked: 0, published: [], skipped: 0 };
  const db = env.DB;

  const { fixtures } = await getFixtures(env, DEFAULT_COMPETITION_ID, DEFAULT_SEASON);
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString();
  const already = await publishedFixtureIds(db);

  const candidates = fixtures
    .filter((fixture) => fixture.state === "full_time")
    .filter((fixture) => fixture.kickoffUtc >= cutoff)
    .filter((fixture) => !already.has(fixture.id))
    // เก่าก่อน เพื่อให้นัดที่รออยู่นานที่สุดได้ออกก่อน
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  const published: string[] = [];
  let skipped = 0;

  for (const fixture of candidates.slice(0, MAX_PER_RUN)) {
    try {
      const bundle = await getMatchBundle(env, fixture.id, DEFAULT_COMPETITION_ID, DEFAULT_SEASON);
      if (!bundle) { skipped += 1; continue; }

      const report = buildMatchReport(bundle.fixture, bundle.teamStats, bundle.events, bundle.standings);
      // ข้อมูลไม่พอจะเป็นข่าว — ไม่บันทึกว่าเผยแพร่แล้ว เพื่อให้ลองใหม่รอบหน้า
      // ตอนที่ผู้ให้บริการเติมสถิติเข้ามา (มักช้ากว่าสกอร์หลายสิบนาที)
      if (!report) { skipped += 1; continue; }

      await upsertStory(db, toStory(report, `/?match=${fixture.id}`));
      await db.prepare(`INSERT INTO football_match_reports (fixture_id, story_id, version, published_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(fixture_id) DO UPDATE SET
          story_id = excluded.story_id, version = excluded.version, published_at = excluded.published_at`)
        .bind(fixture.id, report.storyId, report.version, report.publishedAt)
        .run();
      published.push(fixture.id);
    } catch {
      // นัดเดียวพังไม่ควรทำให้ทั้งรอบพัง — นัดที่เหลือต้องได้ออก
      skipped += 1;
    }
  }

  return { checked: candidates.length, published, skipped };
}
