import { MU_KEYWORDS } from "@/config/mu-keywords";
import { fetchGuardian } from "@/services/news/guardian";
import { RSS_NEWS_SOURCES } from "@/config/news-sources";
import type { Category, EditorialAngle, Story, StorySource } from "@/lib/types";
import {
  ensureDatabase,
  getDigest,
  listStories,
  saveDigest,
  upsertStory,
  type RuntimeEnv,
} from "@/lib/server/database";
import { collectXWatchlist } from "@/lib/server/x/collector";
import { fetchBestArticleText } from "@/lib/server/article";

type RawItem = {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  author?: string;
  handle?: string;
};

type Cluster = {
  title: string;
  description: string;
  publishedAt: string;
  items: RawItem[];
};

type ClaudeEditorial = {
  index: number;
  titleTh: string;
  summaryTh: string;
  contentTh: string;
  angles: EditorialAngle[];
};

// โมเดล Claude ที่ใช้เขียน/แปลข่าวไทย — override ได้ด้วย secret ANTHROPIC_MODEL
// หมายเหตุ: รุ่นนี้คิดก่อนตอบเป็นค่าเริ่มต้น และไม่รับ temperature (ส่งไปจะได้ 400)
// จึงคุมความลึก/ค่าใช้จ่ายด้วย output_config.effort แทน
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";
// คิดก่อนตอบทำให้ตอบช้ากว่าเดิม — 30 วิเดิมตัดกลางคันจนตกไปใช้พาดหัวอังกฤษ
const ANTHROPIC_TIMEOUT_MS = 120_000;

// บังคับรูปแบบผลลัพธ์ด้วย structured outputs — เดิมขอ JSON ผ่าน prompt เฉย ๆ
// แล้วบางครั้งได้ JSON ที่ปิดวงเล็บไม่ครบ parse ไม่ผ่าน ข่าวเลยไม่ถูกแปลทั้งชุด
const EDITORIAL_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          titleTh: { type: "string" },
          summaryTh: { type: "string" },
          contentTh: { type: "string" },
          angles: {
            type: "array",
            items: {
              type: "object",
              properties: { hook: { type: "string" }, why: { type: "string" } },
              required: ["hook", "why"],
              additionalProperties: false,
            },
          },
        },
        required: ["index", "titleTh", "summaryTh", "contentTh", "angles"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "in", "is",
  "it", "of", "on", "or", "that", "the", "to", "with", "manchester", "united", "man", "utd",
]);

const TOPIC_VOCABULARY = [
  "Bruno Fernandes", "Kobbie Mainoo", "Mason Mount", "Manuel Ugarte", "Andrey Santos",
  "Youri Tielemans", "Matheus Cunha", "Bryan Mbeumo", "Benjamin Sesko", "Joshua Zirkzee",
  "Amad", "Leny Yoro", "Lisandro Martinez", "Matthijs de Ligt", "Harry Maguire", "Luke Shaw",
  "Diogo Dalot", "Patrick Dorgu", "Michael Carrick", "Old Trafford", "INEOS", "transfer",
  "injury", "stadium", "academy", "Champions League", "Premier League",
];

const CATEGORY_RULES: Array<{ category: Category; terms: string[] }> = [
  { category: "Injury", terms: ["injury", "injured", "fitness", "ruled out", "recovery", "surgery", "medical update"] },
  { category: "Quotes/Press", terms: ["says", "said", "speaks", "press conference", "interview", "admits", "insists", "reveals"] },
  { category: "Stats/Analysis", terms: ["analysis", "tactical", "stats", "data", "numbers", "explained", "scouting", "ranked"] },
  { category: "Club/Business", terms: ["stadium", "ineos", "ratcliffe", "revenue", "finance", "board", "chief executive", "ownership", "sponsor"] },
  { category: "Match/Preview", terms: ["preview", "line-up", "lineup", "match", "fixture", "friendly", "vs ", "v ", "kick-off", "report", "highlights"] },
  { category: "Transfer", terms: ["signs", "signing", "signed", "transfer", "bid", "deal", "fee", "contract", "loan", "joins", "agrees"] },
  { category: "Rumour", terms: ["rumour", "rumor", "linked", "could move", "eyeing", "interested in", "monitoring", "considering"] },
];

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function plainText(value: string) {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return plainText(match[1]);
  }
  return "";
}

function safeIso(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function parseRss(xml: string, sourceName: string): RawItem[] {
  const blocks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks.flatMap((block) => {
    const title = tag(block, ["title"]);
    const description = tag(block, ["description", "summary", "content:encoded", "content"]);
    const rssLink = tag(block, ["link", "guid"]);
    const atomLink = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? "";
    const url = decodeXml(atomLink || rssLink);
    const publishedAt = safeIso(tag(block, ["pubDate", "published", "updated", "dc:date"]));
    const author = tag(block, ["dc:creator", "author"]);
    if (!title || !url.startsWith("http")) return [];
    return [{ title, description, url, publishedAt, sourceName, author }];
  });
}

async function fetchText(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "user-agent": "GOG-Newsroom/1.0 (+news-intelligence; headline-summary-only)",
      accept: "application/rss+xml, application/xml, text/xml, application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

/** ผลของแหล่งข่าวหนึ่งแหล่งในรอบซิงก์หนึ่งรอบ */
export type SourceOutcome = {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  items: RawItem[];
  error: string;
};

/**
 * ดึงฟีดทุกแหล่งพร้อมกัน แล้วรายงานผลรายแหล่ง ไม่ใช่ยุบรวมเป็นก้อนเดียว
 * รุ่นเดิมใช้ flatMap ทิ้งผลที่ล้มเหลวไปเงียบ ๆ ทำให้ไม่มีทางรู้เลยว่า
 * ฟีดไหนตายไปแล้ว — ข่าวก็ยังไหลมาจากแหล่งอื่นจนดูเหมือนระบบปกติดี
 */
async function fetchRssBySource(): Promise<SourceOutcome[]> {
  const settled = await Promise.allSettled(
    RSS_NEWS_SOURCES.map(async (source) => parseRss(await fetchText(source.feedUrl), source.name)),
  );
  return settled.map((result, index) => {
    const source = RSS_NEWS_SOURCES[index];
    if (result.status === "fulfilled") {
      return { sourceId: source.id, sourceName: source.name, ok: true, items: result.value, error: "" };
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return { sourceId: source.id, sourceName: source.name, ok: false, items: [], error: reason.slice(0, 200) };
  });
}

async function fetchNewsApi(key: string): Promise<RawItem[]> {
  const params = new URLSearchParams({
    q: '"Manchester United"',
    language: "en",
    sortBy: "publishedAt",
    pageSize: "40",
    apiKey: key,
  });
  const payload = JSON.parse(await fetchText(`https://newsapi.org/v2/everything?${params}`)) as {
    articles?: Array<{
      title?: string;
      description?: string;
      url?: string;
      publishedAt?: string;
      author?: string;
      source?: { name?: string };
    }>;
  };
  return (payload.articles ?? []).flatMap((article) => {
    if (!article.title || !article.url) return [];
    return [{
      title: article.title,
      description: article.description ?? "",
      url: article.url,
      publishedAt: safeIso(article.publishedAt ?? ""),
      sourceName: article.source?.name ?? "NewsAPI source",
      author: article.author,
    }];
  });
}

export function matchesManchesterUnited(item: Pick<RawItem, "title" | "description">) {
  const haystack = `${item.title} ${item.description}`.toLocaleLowerCase("en");
  return MU_KEYWORDS.some((keyword) => haystack.includes(keyword.toLocaleLowerCase("en")));
}

function normalizeTitle(title: string) {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(" ");
}

function levenshtein(a: string, b: string) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return previous[b.length];
}

export function titleSimilarity(left: string, right: string) {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function clusterItems(items: RawItem[]) {
  const clusters: Cluster[] = [];
  for (const item of items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const existing = clusters.find((cluster) => titleSimilarity(cluster.title, item.title) > 0.8);
    if (existing) {
      if (!existing.items.some((candidate) => candidate.url === item.url)) existing.items.push(item);
      if (item.description.length > existing.description.length) existing.description = item.description;
      if (item.publishedAt < existing.publishedAt) existing.publishedAt = item.publishedAt;
    } else {
      clusters.push({ title: item.title, description: item.description, publishedAt: item.publishedAt, items: [item] });
    }
  }
  return clusters;
}

export function categorizeStory(title: string, description = ""): Category {
  const text = `${title} ${description}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => text.includes(term))) return rule.category;
  }
  return "Rumour";
}

function sourceAssessment(item: RawItem) {
  const identity = `${item.sourceName} ${item.author ?? ""} ${item.handle ?? ""}`.toLowerCase();
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (identity.includes("ornstein")) return { tier: 1 as const, score: 98 };
  if (identity.includes("fabrizio") && text.includes("here we go")) return { tier: 1 as const, score: 98 };
  if (identity.includes("bbc")) return { tier: 1 as const, score: 95 };
  if (identity.includes("athletic")) return { tier: 1 as const, score: 92 };
  if (identity.includes("telegraph")) return { tier: 2 as const, score: 82 };
  if (["lauriewhitwell", "andy mitten", "andymitten", "simonpeach", "simon peach"].some((name) => identity.includes(name))) {
    return { tier: 2 as const, score: 86 };
  }
  if (identity.includes("fabrizio")) return { tier: 2 as const, score: 85 };
  if (["sistoney67", "howardnurse", "telegraphducker", "lukeedwardstele"].some((name) => identity.includes(name))) {
    return { tier: 2 as const, score: 78 };
  }
  return { tier: 3 as const, score: 55 };
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function toSource(item: RawItem): StorySource {
  const assessment = sourceAssessment(item);
  return {
    name: item.sourceName,
    url: item.url,
    domain: domainOf(item.url),
    author: item.author || undefined,
    handle: item.handle || undefined,
    tier: assessment.tier,
    publishedAt: item.publishedAt,
  };
}

function credibilityFor(items: RawItem[]) {
  const assessments = items.map(sourceAssessment);
  const independentHighQuality = new Set(
    items.flatMap((item, index) => (assessments[index].tier <= 2 ? [domainOf(item.url) === "x.com" ? item.handle ?? item.sourceName : domainOf(item.url)] : [])),
  );
  const verified = independentHighQuality.size >= 2;
  return {
    score: Math.min(100, Math.max(...assessments.map((entry) => entry.score)) + (verified ? 10 : 0)),
    verified,
  };
}

function bangkokDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function storyId(title: string) {
  let hash = 2166136261;
  for (const character of normalizeTitle(title)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `gog_${(hash >>> 0).toString(36)}`;
}

function extractTopics(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  return TOPIC_VOCABULARY.filter((term) => text.includes(term.toLowerCase())).slice(0, 6);
}

function defaultAngles(category: Category, title: string): EditorialAngle[] {
  const shortTitle = title.length > 105 ? `${title.slice(0, 102)}…` : title;
  return [
    {
      hook: `จับตา: ${shortTitle}`,
      why: `แยกประเด็น${category === "Rumour" ? "ข่าวลือกับข้อเท็จจริงที่ยืนยันแล้ว" : "ที่อาจกระทบต่อทีม"} ให้แฟนผีแดงไทยตามข่าวได้อย่างมีบริบท`,
    },
    {
      hook: `อย่าเพิ่งเชื่อ—แหล่งข่าวบอกอะไรจริง?`,
      why: "เทียบลำดับเวลาและน้ำหนักของแต่ละแหล่ง เพื่อบอกว่าข่าวนี้อยู่ขั้นไหนโดยไม่เติมข้อมูลเกินต้นฉบับ",
    },
  ];
}

function fallbackEditorial(cluster: Cluster, category: Category, index: number): ClaudeEditorial {
  return {
    index,
    titleTh: cluster.title,
    summaryTh: "ยังไม่ได้แปลข่าวนี้ — กดปุ่ม \"แปลเป็นไทย\" เพื่อให้ระบบดึงเนื้อข่าวเต็มมาเรียบเรียง",
    contentTh: "",
    angles: defaultAngles(category, cluster.title),
  };
}

function parseJsonPayload(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as unknown;
}

type EditorialInput = {
  index: number;
  category: Category;
  title_en: string;
  source_excerpt: string;
  /** เนื้อข่าวเต็มจากหน้าต้นฉบับ — ว่างได้ถ้าดึงไม่สำเร็จ (paywall / JS-only) */
  article_body: string;
};

// เรียก Claude แปล/เรียบเรียงเป็นไทย — คืน Map ของ index ที่แปลสำเร็จเท่านั้น
// ตัวนี้ถูกเรียกจากปุ่ม "แปลไทย" ของผู้ใช้เท่านั้น ครอนไม่แตะ (กันค่า API ไหลทิ้ง)
async function requestEditorial(inputs: EditorialInput[], env: RuntimeEnv) {
  const empty = new Map<number, ClaudeEditorial>();
  const diagnostics: string[] = [];
  if (!env.ANTHROPIC_API_KEY || !inputs.length) return { items: empty, diagnostics };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 16_000,
      output_config: { effort: "low", format: { type: "json_schema", schema: EDITORIAL_SCHEMA } },
      system: "You are a careful Thai sports desk editor. Never add a fact that is not present in the supplied headline, excerpt, or article body. Preserve uncertainty and attribution. Return only valid JSON.",
      messages: [{
        role: "user",
        content: `Rewrite each supplied item for Thai Manchester United supporters. For every index return: titleTh (professional, not clickbait), summaryTh (2-3 concise Thai sentences), contentTh (the full story rewritten in Thai, 3-6 short paragraphs separated by a blank line, covering every substantive fact in article_body including names, numbers, dates and quotes; if article_body is empty, write only what the headline and excerpt support and say plainly that the full text could not be retrieved), and angles (exactly 2 objects with hook and why for a Thai YouTube/TikTok football channel). Rewrite in your own Thai wording rather than translating sentence-by-sentence, and attribute quotes to who said them. Do not claim verification; do not invent context, fees, injuries, quotes, or outcomes. JSON shape: {"items":[{"index":0,"titleTh":"","summaryTh":"","contentTh":"","angles":[{"hook":"","why":""}]}]}. INPUT: ${JSON.stringify(inputs)}`,
      }],
    }),
    signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Claude ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
  // ต่อ text block ทุกก้อนเข้าด้วยกัน — โมเดลที่คิดก่อนตอบแบ่ง JSON ออกได้หลายก้อน
  // ของเดิมหยิบแค่ก้อนแรก เลยได้ JSON ที่ถูกตัดกลางแล้ว parse ไม่ผ่านทุกครั้ง
  const text = (payload.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
  const stopReason = payload.stop_reason ?? "";
  if (!text) {
    diagnostics.push(`ไม่มีข้อความตอบกลับ (stop_reason=${stopReason}, blocks=${(payload.content ?? []).map((b) => b.type).join("|")})`);
    return { items: empty, diagnostics };
  }
  try {
    const parsed = parseJsonPayload(text) as { items?: ClaudeEditorial[] };
    const returned = parsed.items ?? [];
    const usable = returned.filter((item) =>
      item?.titleTh && item.summaryTh && item.angles?.length === 2);
    for (const item of usable) item.contentTh = item.contentTh ?? "";
    if (returned.length !== usable.length) {
      diagnostics.push(`${returned.length - usable.length}/${returned.length} รายการที่โมเดลส่งกลับมาไม่ครบฟิลด์`);
    }
    return { items: new Map(usable.map((item) => [item.index, item])), diagnostics };
  } catch (error) {
    diagnostics.push(`อ่าน JSON ไม่ได้ (stop_reason=${stopReason}, ยาว ${text.length} ตัวอักษร): ${error instanceof Error ? error.message : "unknown"}`);
    return { items: empty, diagnostics };
  }
}

function mergeSources(...groups: StorySource[][]) {
  const seen = new Map<string, StorySource>();
  for (const source of groups.flat()) seen.set(source.url, source);
  return [...seen.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}

export async function runIngest(env: RuntimeEnv) {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  const db = env.DB;
  await ensureDatabase(db);
  const startedAt = new Date().toISOString();
  let fetched = 0;
  let matched = 0;
  let stored = 0;
  let note = "";

  // ผังสายข่าวหน้าเว็บอ่านตารางนี้ทุกวินาทีระหว่างซิงก์ เพื่อให้เส้นเดินตามจริง
  const progress = async (stage: string, detail: string, done = false) => {
    try {
      await db.prepare(`INSERT INTO ingest_progress
        (run_started_at, stage, detail, fetched, matched, stored, done, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_started_at) DO UPDATE SET
          stage = excluded.stage, detail = excluded.detail, fetched = excluded.fetched,
          matched = excluded.matched, stored = excluded.stored, done = excluded.done,
          updated_at = excluded.updated_at`)
        .bind(startedAt, stage, detail, fetched, matched, stored, done ? 1 : 0, new Date().toISOString())
        .run();
    } catch { /* รายงานความคืบหน้าไม่สำเร็จ ห้ามทำให้การซิงก์ล้ม */ }
  };

  const sourceOutcomes: SourceOutcome[] = [];

  try {
    await progress("rss", "กำลังอ่านฟีดจากแหล่งข่าว");
    const rssBySource = await fetchRssBySource();
    sourceOutcomes.push(...rssBySource);
    const rssItems = rssBySource.flatMap((outcome) => outcome.items);
    const extras: RawItem[] = [];
    if (env.NEWSAPI_KEY && rssItems.filter(matchesManchesterUnited).length < 5) {
      try { extras.push(...await fetchNewsApi(env.NEWSAPI_KEY)); } catch { note += "NewsAPI unavailable. "; }
    }
    // The Guardian — API ทางการ ต้องมีคีย์ ไม่มีคีย์ก็ข้ามไปเงียบ ๆ แต่รายงานว่าข้าม
    await progress("guardian", "กำลังดึงข่าวจาก The Guardian");
    if (env.GUARDIAN_API_KEY) {
      try {
        const items = await fetchGuardian(env.GUARDIAN_API_KEY, fetchText);
        extras.push(...items.map((item) => ({
          title: item.title,
          description: item.description,
          url: item.url,
          publishedAt: item.publishedAt,
          sourceName: item.sourceName,
          author: item.author,
        })));
        sourceOutcomes.push({
          sourceId: "guardian",
          sourceName: "The Guardian",
          ok: true,
          items: items.map((item) => ({
            title: item.title, description: item.description, url: item.url,
            publishedAt: item.publishedAt, sourceName: item.sourceName,
          })),
          error: "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Guardian unavailable";
        note += "Guardian unavailable. ";
        sourceOutcomes.push({ sourceId: "guardian", sourceName: "The Guardian", ok: false, items: [], error: message.slice(0, 200) });
      }
    } else {
      sourceOutcomes.push({
        sourceId: "guardian", sourceName: "The Guardian", ok: false, items: [],
        error: "ยังไม่ได้ใส่ GUARDIAN_API_KEY",
      });
    }

    await progress("x", "กำลังเก็บโพสต์จากนักข่าวใน X");
    try {
      const xCollection = await collectXWatchlist(env);
      // X ทั้ง watchlist นับเป็นหนึ่งโหนดในผัง เพราะหน้าเว็บจัดกลุ่มไว้แบบนั้น
      sourceOutcomes.push({
        sourceId: "x",
        sourceName: "X Watchlist",
        ok: xCollection.configured && xCollection.errors.length === 0,
        items: [],
        error: xCollection.configured ? xCollection.errors.slice(0, 2).join(" · ").slice(0, 200) : "ยังไม่ได้ตั้งค่าผู้ให้บริการ",
      });
      extras.push(...xCollection.posts.map((post) => ({
        title: post.text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 240),
        description: post.text,
        url: post.postUrl,
        publishedAt: post.createdAt,
        sourceName: post.displayName ?? `@${post.username}`,
        author: post.displayName ?? undefined,
        handle: post.username,
      })));
      // โพสต์ X ที่ดึงมาได้ นับเข้าโหนด X ในผัง
      const xOutcome = sourceOutcomes.find((entry) => entry.sourceId === "x");
      if (xOutcome) xOutcome.items = extras.filter((item) => item.handle);
      if (!xCollection.configured) note += "X collector waiting for a configured provider. ";
      else if (xCollection.errors.length) note += `X collector completed with ${xCollection.errors.length} account error(s). `;
    } catch {
      note += "X collector unavailable. ";
      const xOutcome = sourceOutcomes.find((entry) => entry.sourceId === "x");
      if (xOutcome) { xOutcome.ok = false; xOutcome.error = "ตัวเก็บโพสต์ X ใช้งานไม่ได้"; }
    }
    const rawItems = [...rssItems, ...extras];
    fetched = rawItems.length;
    const relevant = rawItems.filter(matchesManchesterUnited);
    matched = relevant.length;
    await progress("filter", `คัดจาก ${fetched} ชิ้น เหลือที่เกี่ยวกับแมนยู ${matched} ชิ้น`);

    // บันทึกผลรายแหล่ง — ตัวเลข matched ต่อแหล่งคำนวณจากเกณฑ์เดียวกับภาพรวม
    // จึงบวกกันได้ตรงกับยอดรวมเสมอ ไม่ใช่ตัวเลขคนละชุด
    const runRows = sourceOutcomes.map((outcome) => db.prepare(`INSERT INTO source_runs
      (run_started_at, source_id, source_name, ok, fetched, matched, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        startedAt, outcome.sourceId, outcome.sourceName, outcome.ok ? 1 : 0,
        outcome.items.length, outcome.items.filter(matchesManchesterUnited).length,
        outcome.error, new Date().toISOString(),
      ));
    if (runRows.length > 0) {
      try { await db.batch(runRows); } catch { /* สถิติรายแหล่งพลาด ไม่ควรทำให้ซิงก์ล้ม */ }
    }

    const clusters = clusterItems(relevant).slice(0, 40);
    const categories = clusters.map((cluster) => categorizeStory(cluster.title, cluster.description));
    const existingStories = await listStories(db, { days: 21 });
    // เก็บข่าวดิบอย่างเดียว — ไม่เรียก Claude ที่นี่ การแปลเป็นไทยเกิดตอนกดปุ่มเท่านั้น
    const matches = clusters.map((cluster) =>
      existingStories.find((story) => titleSimilarity(story.titleEn, cluster.title) > 0.8));

    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[index];
      const matching = matches[index];
      const incomingSources = cluster.items.map(toSource);
      const sources = mergeSources(matching?.sources ?? [], incomingSources);
      const assessment = credibilityFor(cluster.items.concat(
        (matching?.sources ?? []).map((source) => ({
          title: matching?.titleEn ?? cluster.title,
          description: "",
          url: source.url,
          publishedAt: source.publishedAt,
          sourceName: source.name,
          author: source.author,
          handle: source.handle,
        })),
      ));
      // ข่าวที่แปลไว้แล้วต้องคงคำแปลเดิม ไม่ให้รอบซิงก์ถัดไปทับกลับเป็น placeholder
      const placeholder = fallbackEditorial(cluster, categories[index], index);
      const excerptEn = cluster.description.slice(0, 700) || matching?.excerptEn || "";
      const story: Story = {
        id: matching?.id ?? storyId(cluster.title),
        date: bangkokDate(cluster.publishedAt),
        category: categories[index],
        credibility: assessment.score,
        titleEn: cluster.title,
        excerptEn,
        articleEn: matching?.articleEn ?? "",
        titleTh: matching?.translated ? matching.titleTh : placeholder.titleTh,
        summaryTh: matching?.translated ? matching.summaryTh : placeholder.summaryTh,
        contentTh: matching?.translated ? matching.contentTh : "",
        translated: Boolean(matching?.translated),
        sources,
        url: sources[0]?.url ?? cluster.items[0].url,
        publishedAt: sources.map((source) => source.publishedAt).sort().at(-1) ?? cluster.publishedAt,
        verified: assessment.verified,
        angles: matching?.translated ? matching.angles : placeholder.angles,
        topicTerms: [...new Set([
          ...(matching?.topicTerms ?? []),
          ...extractTopics(cluster.title, cluster.description),
        ])].slice(0, 8),
      };
      await upsertStory(db, story);
      stored += 1;
      // รายงานทุก 5 ข่าว — ถี่กว่านี้คือเขียน D1 บ่อยเกินจำเป็นสำหรับแถบความคืบหน้า
      if (stored % 5 === 0) await progress("store", `บันทึกแล้ว ${stored} จาก ${clusters.length} ข่าว`);
    }

    await progress("done", `เสร็จแล้ว — เก็บ ${stored} ข่าว`, true);
    const finishedAt = new Date().toISOString();
    await db.prepare(`INSERT INTO ingest_runs
      (started_at, finished_at, fetched, matched, stored, status, note)
      VALUES (?, ?, ?, ?, ?, 'success', ?)`)
      .bind(startedAt, finishedAt, fetched, matched, stored, note.trim())
      .run();
    return { startedAt, finishedAt, fetched, matched, stored, note: note.trim() };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    await progress("failed", message.slice(0, 160), true);
    await db.prepare(`INSERT INTO ingest_runs
      (started_at, finished_at, fetched, matched, stored, status, note)
      VALUES (?, ?, ?, ?, ?, 'failed', ?)`)
      .bind(startedAt, finishedAt, fetched, matched, stored, message.slice(0, 500))
      .run();
    throw error;
  }
}

// 🇹🇭 แปลตามคำสั่ง — เรียกจาก POST /api/translate เมื่อผู้ใช้กดปุ่มเท่านั้น
//   ids ว่าง = แปลทุกข่าวที่ยังไม่ได้แปล · force = แปลซ้ำข่าวที่แปลไปแล้ว
//   ผลลัพธ์ถูกเขียนลง D1 ทันที (translated = 1) รอบซิงก์ถัดไปจะไม่ทับกลับ
export async function translateStories(
  env: RuntimeEnv,
  options: { ids?: string[]; force?: boolean; limit?: number } = {},
) {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  await ensureDatabase(env.DB);
  if (!env.ANTHROPIC_API_KEY) {
    return { translated: 0, skipped: 0, stories: [] as Story[], error: "translation_not_configured" as const };
  }

  const ids = options.ids?.filter(Boolean) ?? [];
  const all = await listStories(env.DB, { days: 60 });
  const wanted = ids.length ? all.filter((story) => ids.includes(story.id)) : all;
  const targets = (options.force ? wanted : wanted.filter((story) => !story.translated))
    .slice(0, Math.min(Math.max(options.limit ?? 12, 1), 25));
  if (!targets.length) return { translated: 0, skipped: wanted.length, stories: [] as Story[] };

  // ดึงเนื้อข่าวเต็มจากหน้าต้นฉบับก่อน (ทำพร้อมกันทุกข่าว) — ข่าวไหนดึงไม่ได้ก็ใช้คำโปรยแทน
  const bodies = await Promise.all(targets.map(async (story) => {
    if (story.articleEn.length >= 400) return story.articleEn;
    const urls = [story.url, ...story.sources.map((source) => source.url)];
    const { text } = await fetchBestArticleText([...new Set(urls)]);
    return text;
  }));

  const { items: generated, diagnostics } = await requestEditorial(
    targets.map((story, index) => ({
      index,
      category: story.category,
      title_en: story.titleEn,
      source_excerpt: story.excerptEn || story.sources.map((source) => source.name).join(", "),
      article_body: bodies[index].slice(0, 6_000),
    })),
    env,
  );

  const stories: Story[] = [];
  for (let index = 0; index < targets.length; index += 1) {
    const editorial = generated.get(index);
    if (!editorial) continue;
    const updated: Story = {
      ...targets[index],
      articleEn: bodies[index] || targets[index].articleEn,
      titleTh: editorial.titleTh,
      summaryTh: editorial.summaryTh,
      contentTh: editorial.contentTh,
      angles: editorial.angles,
      translated: true,
    };
    await upsertStory(env.DB, updated);
    stories.push(updated);
  }
  const withBody = bodies.filter((body) => body.length >= 400).length;
  return {
    translated: stories.length,
    skipped: targets.length - stories.length,
    fullText: withBody,
    diagnostics,
    stories,
  };
}

function yesterdayBangkok() {
  const now = new Date();
  return bangkokDate(new Date(now.getTime() - 86_400_000).toISOString());
}

async function claudeDigest(stories: Story[], env: RuntimeEnv) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const evidence = stories.map((story) => ({
    title_th: story.titleTh,
    summary_th: story.summaryTh,
    credibility: story.credibility,
    sources: story.sources.map((source) => source.name),
  }));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 16_000,
      output_config: { effort: "low" },
      system: "You produce concise, factual Thai sports news digests using only the evidence supplied. Never add facts.",
      messages: [{ role: "user", content: `Write a publish-ready Thai morning digest of yesterday's verified Manchester United news. Open with one overview sentence, then short numbered items, then a one-line source/verification note. Evidence: ${JSON.stringify(evidence)}` }],
    }),
    signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = (payload.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  return text || null;
}

export async function generateDailyDigest(env: RuntimeEnv, requestedDate?: string) {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  await ensureDatabase(env.DB);
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : yesterdayBangkok();
  const existing = await getDigest(env.DB, date);
  if (existing) return existing;
  const stories = (await listStories(env.DB, { days: 14 })).filter((story) => story.date === date && story.verified);
  const generated = await claudeDigest(stories, env);
  const contentTh = generated ?? (stories.length
    ? [
        `GOG NEWSROOM • สรุปข่าวแมนเชสเตอร์ ยูไนเต็ด ${date}`,
        "",
        ...stories.map((story, index) => `${index + 1}. ${story.titleTh}\n${story.summaryTh}`),
        "",
        `สรุปเฉพาข่าวที่มีแหล่งคุณภาพยืนยันอิสระ 2 แหล่งขึ้นไป • ${stories.length} ข่าว`,
      ].join("\n")
    : `GOG NEWSROOM • ${date}\n\nไม่พบข่าวแมนเชสเตอร์ ยูไนเต็ดของวันนี้ที่ผ่านเกณฑ์ยืนยันจากแหล่งข่าวคุณภาพอย่างน้อย 2 แหล่ง`);
  const digest = { date, contentTh, storyCount: stories.length, generatedAt: new Date().toISOString() };
  await saveDigest(env.DB, digest);
  return digest;
}

export async function maybeGenerateMorningDigest(env: RuntimeEnv) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour < 7) return null;
  return generateDailyDigest(env);
}
