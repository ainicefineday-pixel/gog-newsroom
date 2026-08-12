// รวมข่าวเรื่องเดียวกันที่คนละสำนักพาดหัวคนละแบบ
// ---------------------------------------------------------------------------
// ปัญหาที่แก้: titleSimilarity เทียบด้วย Levenshtein ทั้งสตริง ซึ่งไม่มีทางถึง
// เกณฑ์เมื่อสองสำนักเขียนพาดหัวคนละแบบ ตรวจกับคลังจริง 103 ข่าวพบว่า
// ไม่มีข่าวไหนเลยมีเกิน 1 โดเมน จึงไม่มีข่าวไหนผ่านเกณฑ์ "ยืนยันข้ามแหล่ง" ได้
// ทั้งที่เรื่อง Myles Lewis-Skelly เรื่องเดียวลงทั้ง Mirror, M.E.N. และ Guardian
//
// ทำไมต้องใช้โมเดลช่วย: ลองใช้กติกา "คำเฉพาะที่ตรงกัน" แล้วได้ผลแย่มาก
// (60 คู่จาก 103 พาดหัว และหลายคู่ผิด เช่นข่าว Rashford หกประเด็นถูกยุบเป็น
// เรื่องเดียว) เพราะชื่อนักเตะที่ตรงกันไม่ได้แปลว่าเป็นข่าวเดียวกัน
//
// สถาปัตยกรรม แบ่งเป็นสองจังหวะเพื่อไม่ให้เปลืองและไม่ให้พัง
//   1. ตัดสิน (วันละ 3 ครั้ง)  — ถามโมเดลว่าพาดหัวไหนเป็นเรื่องเดียวกัน
//                                 เก็บผลลง story_merges อย่างถาวร
//   2. บังคับใช้ (ทุกรอบซิงก์) — พับข่าวที่ถูกยุบเข้าตัวหลักแล้วลบทิ้ง
//                                 เป็นตรรกะล้วน ไม่เรียกโมเดล ไม่มีค่าใช้จ่าย
//
// ต้องเก็บถาวรเพราะรอบซิงก์ถัดไปจะเขียนข่าวที่ยุบไปแล้วกลับเข้ามาใหม่
// (id คิดจากพาดหัว ซึ่งไม่เปลี่ยน) ถ้ารวมทีเดียวจบ ทุกอย่างจะถูกยกเลิกใน 10 นาที

import { listStories, upsertStory, type RuntimeEnv } from "@/lib/server/database";
import type { Story, StorySource } from "@/lib/types";
import { declaredTierFor } from "@/config/news-sources";
import { isRoundupHeadline } from "@/services/news/story-merge-rules";

const DEFAULT_MODEL = "claude-opus-5";
const TIMEOUT_MS = 120_000;

/** ช่วงเวลาที่ให้จัดกลุ่ม (ชั่วโมงตามเวลาไทย) — เช้า กลางวัน เย็น */
const MERGE_HOURS = [7, 13, 19];
/** ดูข่าวย้อนหลังกี่ชั่วโมง — ข่าวเรื่องเดียวกันมักลงห่างกันไม่เกินวันเดียว */
const LOOKBACK_HOURS = 36;
/** ส่งพาดหัวให้โมเดลรอบละไม่เกินเท่านี้ */
const MAX_HEADLINES = 120;

const GROUP_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          indices: { type: "array", items: { type: "integer" } },
          event: { type: "string" },
        },
        required: ["indices", "event"],
        additionalProperties: false,
      },
    },
  },
  required: ["groups"],
  additionalProperties: false,
} as const;

function domainOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** ช่องเวลาปัจจุบันตามเวลาไทย เช่น "2026-08-12-13" — ใช้กันไม่ให้รันซ้ำในช่องเดียวกัน */
export function currentSlot(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  // ตกลงช่องล่าสุดที่ผ่านมาแล้ว — ยังไม่ถึงช่องแรกของวันก็ยังไม่ต้องรัน
  const slotHour = [...MERGE_HOURS].reverse().find((entry) => hour >= entry);
  if (slotHour === undefined) return null;
  return `${get("year")}-${get("month")}-${get("day")}-${String(slotHour).padStart(2, "0")}`;
}

type Group = { indices: number[]; event: string };

async function askClaude(env: RuntimeEnv, headlines: Array<{ index: number; source: string; title: string }>) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 8_000,
      output_config: { effort: "low", format: { type: "json_schema", schema: GROUP_SCHEMA } },
      system: "You group news headlines that report the SAME specific event. You are deliberately conservative: when in doubt, do not group. A wrong grouping makes our site claim two outlets corroborated a story when they did not, which is worse than missing a grouping.",
      messages: [{
        role: "user",
        content: [
          "Group the supplied Manchester United headlines that report the same specific event or the same specific claim.",
          "",
          "GROUP ONLY IF the headlines describe the same concrete news event — the same bid, the same signing, the same injury, the same match, the same statement by the same person.",
          "",
          "DO NOT GROUP:",
          "- headlines about the same player but different claims (e.g. 'Rashford exit latest' vs 'Rashford excited by Carrick' are DIFFERENT events)",
          "- rolling live blogs or transfer round-ups with specific single-story reports",
          "- headlines that merely share a club name, a competition, or generic transfer vocabulary",
          "- previews and match reports of different fixtures",
          "",
          "Return only groups containing 2 or more indices. Omit anything you are not confident about.",
          "For each group, 'event' is a short English description of the specific event that the grouped headlines share.",
          "",
          `INPUT: ${JSON.stringify(headlines)}`,
        ].join("\n"),
      }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Claude ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = (payload.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
  if (!text) return [];
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")) as { groups?: Group[] };
  return Array.isArray(parsed.groups) ? parsed.groups : [];
}

export type MergeDecision = {
  slot: string;
  examined: number;
  grouped: number;
  note: string;
  skipped: boolean;
  /** กลุ่มที่ผ่านการตรวจแล้ว ไว้ให้คนดูก่อนว่าจับถูกไหม */
  preview: Array<{ event: string; primary: string; absorbed: string[]; domains: string[] }>;
};

/**
 * ตัดสินว่าพาดหัวไหนเป็นข่าวเรื่องเดียวกัน แล้วเก็บผลไว้
 * รันวันละ 3 ครั้งตาม MERGE_HOURS — เรียกซ้ำในช่องเดิมจะข้ามทันที ไม่เสียค่า API
 */
export async function decideStoryMerges(env: RuntimeEnv, force = false, dryRun = false): Promise<MergeDecision> {
  const db = env.DB!;
  // force = สั่งเองจากหน้าแอดมิน ต้องข้ามทั้งการเช็กช่วงเวลาและการเช็กว่ารันไปแล้ว
  // ไม่งั้นทดสอบตอนตีหนึ่งจะไม่มีทางรันได้เลยเพราะยังไม่ถึงช่องแรกของวัน
  const slot = currentSlot() ?? (force ? `manual-${new Date().toISOString().slice(0, 13)}` : null);
  if (!slot) return { slot: "", examined: 0, grouped: 0, note: "ยังไม่ถึงช่วงเวลาจัดกลุ่มของวันนี้", skipped: true, preview: [] };
  if (!env.ANTHROPIC_API_KEY) return { slot, examined: 0, grouped: 0, note: "ยังไม่ได้ใส่ ANTHROPIC_API_KEY", skipped: true, preview: [] };

  if (!force) {
    const done = await db.prepare("SELECT slot FROM merge_runs WHERE slot = ?").bind(slot).first();
    if (done) return { slot, examined: 0, grouped: 0, note: "ช่วงเวลานี้จัดกลุ่มไปแล้ว", skipped: true, preview: [] };
  }

  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString();
  const stories = (await listStories(db, { days: 3, minCredibility: 0 }))
    .filter((story) => story.publishedAt >= cutoff)
    .slice(0, MAX_HEADLINES);

  if (stories.length < 2) {
    return { slot, examined: stories.length, grouped: 0, note: "ข่าวน้อยเกินกว่าจะจัดกลุ่ม", skipped: true, preview: [] };
  }

  const headlines = stories.map((story, index) => ({
    index,
    source: story.sources[0]?.name ?? "unknown",
    title: story.titleEn,
  }));

  let groups: Group[] = [];
  let note = "";
  try {
    groups = await askClaude(env, headlines);
  } catch (error) {
    note = error instanceof Error ? error.message.slice(0, 200) : "เรียกโมเดลไม่สำเร็จ";
    // ไม่บันทึกว่ารันช่องนี้แล้ว เพื่อให้ลองใหม่ในรอบซิงก์ถัดไป
    return { slot, examined: stories.length, grouped: 0, note, skipped: true, preview: [] };
  }

  const now = new Date().toISOString();
  const rows: D1PreparedStatement[] = [];
  const preview: MergeDecision["preview"] = [];
  let accepted = 0;

  for (const group of groups) {
    const members = [...new Set(group.indices)]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < stories.length)
      .map((index) => stories[index])
      // ตัดข่าวรวม/บล็อกสดออกจากทุกกลุ่ม ไม่ว่าโมเดลจะจัดมายังไง
      .filter((story) => !isRoundupHeadline(story.titleEn));
    if (members.length < 2) continue;

    // ตรวจซ้ำฝั่งเรา ไม่เชื่อโมเดลอย่างเดียว:
    // ต้องมาจากคนละโดเมนจริง ไม่งั้นการรวมไม่ได้ช่วยเรื่องการยืนยันข้ามแหล่ง
    const domains = new Set(members.flatMap((story) => story.sources.map((source) => domainOf(source.url))));
    if (domains.size < 2) continue;

    // ตัวหลักคือชิ้นที่คะแนนความน่าเชื่อถือสูงสุด เท่ากันเอาชิ้นที่เผยแพร่ก่อน
    const primary = [...members].sort((a, b) =>
      b.credibility - a.credibility || a.publishedAt.localeCompare(b.publishedAt))[0];

    for (const member of members) {
      if (member.id === primary.id) continue;
      rows.push(db.prepare(`INSERT INTO story_merges (absorbed_id, primary_id, reason, decided_by, created_at)
        VALUES (?, ?, ?, 'claude', ?)
        ON CONFLICT(absorbed_id) DO UPDATE SET primary_id = excluded.primary_id, reason = excluded.reason`)
        .bind(member.id, primary.id, group.event.slice(0, 200), now));
    }
    accepted += 1;
    preview.push({
      event: group.event.slice(0, 120),
      primary: primary.titleEn,
      absorbed: members.filter((member) => member.id !== primary.id).map((member) => member.titleEn),
      domains: [...domains],
    });
  }

  // โหมดลองดู — คืนผลให้คนตรวจว่าจับถูกไหม โดยยังไม่แตะฐานข้อมูลเลย
  // งานนี้ลบข่าวทิ้งจริง จึงต้องมีทางดูก่อนตัดสินใจ ไม่ใช่รันแล้วค่อยมาไล่แก้
  if (dryRun) {
    return { slot, examined: stories.length, grouped: accepted, note: `${note} (ลองดูเฉย ๆ ไม่ได้บันทึก)`.trim(), skipped: false, preview };
  }

  if (rows.length > 0) await db.batch(rows);
  await db.prepare(`INSERT INTO merge_runs (slot, examined, grouped, note, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(slot) DO UPDATE SET examined = excluded.examined, grouped = excluded.grouped, note = excluded.note`)
    .bind(slot, stories.length, accepted, note, now)
    .run();

  return { slot, examined: stories.length, grouped: accepted, note, skipped: false, preview };
}

/**
 * พับข่าวที่ถูกยุบเข้าตัวหลัก แล้วลบตัวที่ถูกยุบทิ้ง
 *
 * เป็นตรรกะล้วน ไม่เรียกโมเดล จึงรันได้ทุกรอบซิงก์โดยไม่มีค่าใช้จ่าย
 * และต้องรันทุกรอบ เพราะรอบซิงก์เขียนข่าวที่ยุบไปแล้วกลับเข้ามาใหม่ทุกครั้ง
 */
export async function applyStoryMerges(env: RuntimeEnv) {
  const db = env.DB!;
  const merges = (await db.prepare("SELECT absorbed_id, primary_id FROM story_merges")
    .all<{ absorbed_id: string; primary_id: string }>()).results ?? [];
  if (merges.length === 0) return { folded: 0, removed: 0 };

  const stories = await listStories(db, { days: 7, minCredibility: 0 });
  const byId = new Map(stories.map((story) => [story.id, story]));

  const byPrimary = new Map<string, string[]>();
  for (const row of merges) {
    if (!byId.has(row.absorbed_id)) continue;
    byPrimary.set(row.primary_id, [...(byPrimary.get(row.primary_id) ?? []), row.absorbed_id]);
  }

  let folded = 0;
  let removed = 0;

  for (const [primaryId, absorbedIds] of byPrimary) {
    const primary = byId.get(primaryId);
    if (!primary) continue;

    const merged: StorySource[] = [...primary.sources];
    for (const absorbedId of absorbedIds) {
      const absorbed = byId.get(absorbedId);
      if (!absorbed) continue;
      for (const source of absorbed.sources) {
        if (!merged.some((existing) => existing.url === source.url)) merged.push(source);
      }
    }
    if (merged.length === primary.sources.length) continue;

    // ยืนยันข้ามแหล่งด้วยกติกาเดิมเป๊ะ ๆ — โดเมนต่างกันตั้งแต่สองโดเมนที่ tier ≤ 2
    //
    // แต่คิด tier ใหม่จากไดเรกทอรี ไม่เชื่อค่าที่ติดมากับข่าวในคลัง
    // เพราะ tier ถูกเขียนตอน ingest ข่าวที่เข้ามาก่อนแก้ค่าใน config จึงค้างของเก่า
    // ตรวจคลังจริงเจอ M.E.N. 13 ชิ้นและ Sky 4 ชิ้นยังเป็น tier 3 อยู่
    // ทั้งที่ประกาศไว้ 2 กับ 1 — ข่าวพวกนั้นเลยยืนยันไม่ผ่านทั้งที่ควรผ่าน
    const tierOf = (source: StorySource) => declaredTierFor(source.url, source.handle) ?? source.tier;
    const independent = new Set(
      merged.filter((source) => tierOf(source) <= 2)
        .map((source) => (domainOf(source.url) === "x.com" ? source.handle ?? source.name : domainOf(source.url))),
    );
    const verified = independent.size >= 2;

    const updated: Story = {
      ...primary,
      sources: merged,
      verified,
      credibility: Math.min(100, Math.max(...merged.map((source) => (source.tier === 1 ? 92 : source.tier === 2 ? 84 : 55))) + (verified ? 10 : 0)),
    };
    await upsertStory(db, updated);
    folded += 1;

    for (const absorbedId of absorbedIds) {
      if (!byId.has(absorbedId)) continue;
      await db.prepare("DELETE FROM stories WHERE id = ?").bind(absorbedId).run();
      await db.prepare("DELETE FROM story_source_events WHERE story_id = ?").bind(absorbedId).run();
      removed += 1;
    }
  }

  return { folded, removed };
}
