import { MU_KEYWORDS } from "@/config/mu-keywords";
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
  angles: EditorialAngle[];
};

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

async function fetchRssItems() {
  const settled = await Promise.allSettled(
    RSS_NEWS_SOURCES.map(async (source) => parseRss(await fetchText(source.feedUrl), source.name)),
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
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
    summaryTh: "ยังไม่ได้ตั้งค่าระบบแปลอัตโนมัติ โปรดตรวจสอบพาดหัวและแหล่งข่าวต้นฉบับก่อนนำไปเผยแพร่",
    angles: defaultAngles(category, cluster.title),
  };
}

function parseJsonPayload(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as unknown;
}

async function createEditorial(clusters: Cluster[], categories: Category[], env: RuntimeEnv) {
  const fallback = clusters.map((cluster, index) => fallbackEditorial(cluster, categories[index], index));
  if (!env.ANTHROPIC_API_KEY || !clusters.length) return fallback;

  const inputs = clusters.map((cluster, index) => ({
    index,
    category: categories[index],
    title_en: cluster.title,
    source_excerpt: cluster.description.slice(0, 700),
  }));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 5000,
      temperature: 0.15,
      system: "You are a careful Thai sports desk editor. Never add a fact that is not present in the supplied headline or excerpt. Preserve uncertainty and attribution. Return only valid JSON.",
      messages: [{
        role: "user",
        content: `Rewrite each supplied item for Thai Manchester United supporters. For every index return: titleTh (professional, not clickbait), summaryTh (2-3 concise Thai sentences), and angles (exactly 2 objects with hook and why for a Thai YouTube/TikTok football channel). Do not claim verification; do not invent context, fees, injuries, quotes, or outcomes. JSON shape: {"items":[{"index":0,"titleTh":"","summaryTh":"","angles":[{"hook":"","why":""}]}]}. INPUT: ${JSON.stringify(inputs)}`,
      }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return fallback;
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((part) => part.type === "text")?.text;
  if (!text) return fallback;
  try {
    const parsed = parseJsonPayload(text) as { items?: ClaudeEditorial[] };
    const byIndex = new Map((parsed.items ?? []).map((item) => [item.index, item]));
    return fallback.map((entry) => {
      const generated = byIndex.get(entry.index);
      if (!generated?.titleTh || !generated.summaryTh || generated.angles?.length !== 2) return entry;
      return generated;
    });
  } catch {
    return fallback;
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

  try {
    const rssItems = await fetchRssItems();
    const extras: RawItem[] = [];
    if (env.NEWSAPI_KEY && rssItems.filter(matchesManchesterUnited).length < 5) {
      try { extras.push(...await fetchNewsApi(env.NEWSAPI_KEY)); } catch { note += "NewsAPI unavailable. "; }
    }
    try {
      const xCollection = await collectXWatchlist(env);
      extras.push(...xCollection.posts.map((post) => ({
        title: post.text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 240),
        description: post.text,
        url: post.postUrl,
        publishedAt: post.createdAt,
        sourceName: post.displayName ?? `@${post.username}`,
        author: post.displayName ?? undefined,
        handle: post.username,
      })));
      if (!xCollection.configured) note += "X collector waiting for a configured provider. ";
      else if (xCollection.errors.length) note += `X collector completed with ${xCollection.errors.length} account error(s). `;
    } catch {
      note += "X collector unavailable. ";
    }
    const rawItems = [...rssItems, ...extras];
    fetched = rawItems.length;
    const relevant = rawItems.filter(matchesManchesterUnited);
    matched = relevant.length;
    const clusters = clusterItems(relevant).slice(0, 40);
    const categories = clusters.map((cluster) => categorizeStory(cluster.title, cluster.description));
    const editorials = await createEditorial(clusters, categories, env);
    const existingStories = await listStories(db, { days: 21 });

    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[index];
      const matching = existingStories.find((story) => titleSimilarity(story.titleEn, cluster.title) > 0.8);
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
      const editorial = editorials[index];
      const translated = !editorial.summaryTh.startsWith("ยังไม่ได้ตั้งค่า");
      const story: Story = {
        id: matching?.id ?? storyId(cluster.title),
        date: bangkokDate(cluster.publishedAt),
        category: categories[index],
        credibility: assessment.score,
        titleEn: cluster.title,
        titleTh: translated || !matching ? editorial.titleTh : matching.titleTh,
        summaryTh: translated || !matching ? editorial.summaryTh : matching.summaryTh,
        sources,
        url: sources[0]?.url ?? cluster.items[0].url,
        publishedAt: sources.map((source) => source.publishedAt).sort().at(-1) ?? cluster.publishedAt,
        verified: assessment.verified,
        angles: translated || !matching ? editorial.angles : matching.angles,
        topicTerms: [...new Set([
          ...(matching?.topicTerms ?? []),
          ...extractTopics(cluster.title, cluster.description),
        ])].slice(0, 8),
      };
      await upsertStory(db, story);
      stored += 1;
    }

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
    await db.prepare(`INSERT INTO ingest_runs
      (started_at, finished_at, fetched, matched, stored, status, note)
      VALUES (?, ?, ?, ?, ?, 'failed', ?)`)
      .bind(startedAt, finishedAt, fetched, matched, stored, message.slice(0, 500))
      .run();
    throw error;
  }
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
      model: env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 1800,
      temperature: 0.1,
      system: "You produce concise, factual Thai sports news digests using only the evidence supplied. Never add facts.",
      messages: [{ role: "user", content: `Write a publish-ready Thai morning digest of yesterday's verified Manchester United news. Open with one overview sentence, then short numbered items, then a one-line source/verification note. Evidence: ${JSON.stringify(evidence)}` }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  return payload.content?.find((part) => part.type === "text")?.text?.trim() || null;
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
