import type { RuntimeEnv } from "@/lib/server/database";

export const X_USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

export type XProviderKind = "third_party" | "public_source" | "mock";

export type NormalizedXPost = {
  postId: string | null;
  postUrl: string;
  username: string;
  displayName: string | null;
  authorProfileUrl: string;
  text: string;
  createdAt: string;
  mediaUrls: string[];
  externalUrls: string[];
  replyCount: number | null;
  repostCount: number | null;
  likeCount: number | null;
  quoteCount: number | null;
  viewCount: number | null;
  detectedLanguage: string | null;
  collectedAt: string;
  source: string;
  rawData: unknown;
};

export type XPublicUser = {
  username: string;
  displayName: string | null;
  profileUrl: string;
};

export interface XDataProvider {
  readonly kind: XProviderKind;
  getUser(username: string): Promise<XPublicUser>;
  getRecentPosts(username: string, limit: number): Promise<NormalizedXPost[]>;
  searchPosts?(query: string, limit: number): Promise<NormalizedXPost[]>;
  getPost?(postIdOrUrl: string): Promise<NormalizedXPost | null>;
}

export type XProviderErrorCode =
  | "provider_unavailable"
  | "provider_authentication_error"
  | "provider_rate_limited"
  | "invalid_username"
  | "provider_response_invalid";

export class XProviderError extends Error {
  constructor(
    public readonly code: XProviderErrorCode,
    message: string,
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "XProviderError";
  }
}

function validateUsername(username: string) {
  if (!X_USERNAME_PATTERN.test(username)) {
    throw new XProviderError("invalid_username", "X username must contain only letters, numbers, or underscores.");
  }
  return username;
}

function safeIso(value: unknown) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => typeof entry === "string" && /^https?:\/\//i.test(entry) ? [entry] : []);
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of ["posts", "items", "results", "data"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    const nested = asRecord(value);
    for (const nestedKey of ["posts", "items", "results"]) {
      if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[];
    }
  }
  return [];
}

function normalizeThirdPartyPost(value: unknown, requestedUsername: string, source: string): NormalizedXPost | null {
  const record = asRecord(value);
  const author = asRecord(record.author ?? record.user);
  const username = firstString(record, ["username", "screen_name", "handle"])
    ?? firstString(author, ["username", "screen_name", "handle"])
    ?? requestedUsername;
  const text = firstString(record, ["text", "post_text", "full_text", "content"]);
  const postId = firstString(record, ["id", "post_id", "tweet_id", "rest_id"]);
  const postUrl = firstString(record, ["url", "post_url", "tweet_url", "permalink"])
    ?? (postId ? `https://x.com/${username}/status/${postId}` : null);
  if (!text || !postUrl || !/^https?:\/\//i.test(postUrl) || !X_USERNAME_PATTERN.test(username)) return null;
  const metrics = asRecord(record.metrics ?? record.public_metrics);
  const media = record.media_urls ?? record.media ?? asRecord(record.entities).media_urls;
  const links = record.external_urls ?? record.urls ?? asRecord(record.entities).urls;
  return {
    postId,
    postUrl,
    username,
    displayName: firstString(record, ["display_name", "name"]) ?? firstString(author, ["display_name", "name"]),
    authorProfileUrl: `https://x.com/${username}`,
    text,
    createdAt: safeIso(record.created_at ?? record.published_at ?? record.date),
    mediaUrls: stringArray(media),
    externalUrls: stringArray(links),
    replyCount: nullableNumber(record.reply_count ?? metrics.reply_count ?? metrics.replies),
    repostCount: nullableNumber(record.repost_count ?? record.retweet_count ?? metrics.repost_count ?? metrics.retweets),
    likeCount: nullableNumber(record.like_count ?? record.favorite_count ?? metrics.like_count ?? metrics.likes),
    quoteCount: nullableNumber(record.quote_count ?? metrics.quote_count ?? metrics.quotes),
    viewCount: nullableNumber(record.view_count ?? record.impression_count ?? metrics.view_count ?? metrics.impressions),
    detectedLanguage: firstString(record, ["language", "lang", "detected_language"]),
    collectedAt: new Date().toISOString(),
    source,
    rawData: value,
  };
}

function requestTimeout(env: RuntimeEnv) {
  const seconds = Number(env.X_REQUEST_TIMEOUT_SECONDS ?? 20);
  return Math.min(Math.max(Number.isFinite(seconds) ? seconds : 20, 5), 30) * 1000;
}

async function fetchWithBackoff(url: string, env: RuntimeEnv, headers: HeadersInit = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: "application/json, application/rss+xml, application/xml, text/xml", ...headers },
        signal: AbortSignal.timeout(requestTimeout(env)),
      });
    } catch (error) {
      if (attempt === 2) throw new XProviderError("provider_unavailable", error instanceof Error ? error.message : "Provider request failed");
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new XProviderError("provider_authentication_error", `Provider rejected credentials (${response.status}).`);
    }
    if (response.status === 429) {
      const retryAfter = nullableNumber(response.headers.get("retry-after"));
      if (attempt === 2) throw new XProviderError("provider_rate_limited", "The configured provider is rate limited.", retryAfter);
      await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
      continue;
    }
    if (response.status >= 500) {
      if (attempt === 2) throw new XProviderError("provider_unavailable", `Provider unavailable (${response.status}).`);
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
      continue;
    }
    if (!response.ok) throw new XProviderError("provider_unavailable", `Provider returned HTTP ${response.status}.`);
    return response;
  }
  throw new XProviderError("provider_unavailable", "Provider request failed.");
}

class ThirdPartyProvider implements XDataProvider {
  readonly kind = "third_party" as const;
  constructor(private readonly env: RuntimeEnv) {}

  async getUser(username: string) {
    validateUsername(username);
    return { username, displayName: null, profileUrl: `https://x.com/${username}` };
  }

  async getRecentPosts(username: string, limit: number) {
    validateUsername(username);
    if (!this.env.X_PROVIDER_BASE_URL) throw new XProviderError("provider_unavailable", "X_PROVIDER_BASE_URL is not configured.");
    const base = new URL(this.env.X_PROVIDER_BASE_URL);
    if (!["https:", "http:"].includes(base.protocol)) throw new XProviderError("provider_unavailable", "Provider URL must use HTTP or HTTPS.");
    const pathTemplate = this.env.X_PROVIDER_RECENT_PATH ?? "/users/{username}/posts";
    const endpoint = new URL(pathTemplate.replace("{username}", encodeURIComponent(username)), base);
    endpoint.searchParams.set("limit", String(limit));
    const headers: HeadersInit = this.env.X_PROVIDER_API_KEY ? { authorization: `Bearer ${this.env.X_PROVIDER_API_KEY}` } : {};
    const response = await fetchWithBackoff(endpoint.toString(), this.env, headers);
    const payload = await response.json() as unknown;
    return extractItems(payload)
      .map((item) => normalizeThirdPartyPost(item, username, "third_party"))
      .filter((item): item is NormalizedXPost => Boolean(item))
      .slice(0, limit);
  }
}

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function xmlText(value: string) {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function xmlTag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return xmlText(match[1]);
  }
  return "";
}

class PublicSourceProvider implements XDataProvider {
  readonly kind = "public_source" as const;
  constructor(private readonly env: RuntimeEnv) {}

  async getUser(username: string) {
    validateUsername(username);
    return { username, displayName: null, profileUrl: `https://x.com/${username}` };
  }

  async getRecentPosts(username: string, limit: number) {
    validateUsername(username);
    const template = this.env.X_PUBLIC_FEED_URL_TEMPLATE;
    if (!template?.includes("{username}")) throw new XProviderError("provider_unavailable", "A public feed URL template is not configured.");
    const feedUrl = template.replace("{username}", encodeURIComponent(username));
    const parsedUrl = new URL(feedUrl);
    if (!["https:", "http:"].includes(parsedUrl.protocol)) throw new XProviderError("provider_unavailable", "Public feed URL must use HTTP or HTTPS.");
    const response = await fetchWithBackoff(parsedUrl.toString(), this.env);
    const xml = await response.text();
    const blocks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
    return blocks.slice(0, limit).flatMap((block): NormalizedXPost[] => {
      const title = xmlTag(block, ["title"]);
      const description = xmlTag(block, ["description", "summary", "content"]);
      const text = description || title;
      const taggedLink = xmlTag(block, ["link", "guid"]);
      const atomLink = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? "";
      const postUrl = decodeXml(atomLink || taggedLink);
      const postId = postUrl.match(/\/status\/(\d+)/)?.[1] ?? null;
      if (!text || !/^https?:\/\//i.test(postUrl)) return [];
      return [{
        postId,
        postUrl,
        username,
        displayName: null,
        authorProfileUrl: `https://x.com/${username}`,
        text,
        createdAt: safeIso(xmlTag(block, ["pubDate", "published", "updated", "dc:date"])),
        mediaUrls: [],
        externalUrls: [],
        replyCount: null,
        repostCount: null,
        likeCount: null,
        quoteCount: null,
        viewCount: null,
        detectedLanguage: null,
        collectedAt: new Date().toISOString(),
        source: "public_source",
        rawData: { title, description, postUrl },
      }];
    });
  }
}

export class MockXProvider implements XDataProvider {
  readonly kind = "mock" as const;
  async getUser(username: string) {
    validateUsername(username);
    return { username, displayName: `@${username}`, profileUrl: `https://x.com/${username}` };
  }
  async getRecentPosts(username: string, limit: number) {
    validateUsername(username);
    const postId = `189000000${username.toLowerCase().split("").reduce((sum, character) => sum + character.charCodeAt(0), 0)}`;
    return [{
      postId,
      postUrl: `https://x.com/${username}/status/${postId}`,
      username,
      displayName: `@${username}`,
      authorProfileUrl: `https://x.com/${username}`,
      text: "Manchester United example public post for collector testing only",
      createdAt: "2026-08-09T10:00:00Z",
      mediaUrls: [],
      externalUrls: [],
      replyCount: 80,
      repostCount: 120,
      likeCount: 1200,
      quoteCount: null,
      viewCount: 45000,
      detectedLanguage: "en",
      collectedAt: new Date().toISOString(),
      source: "mock",
      rawData: { mock: true },
    }].slice(0, limit);
  }
}

export function getXProviderStatus(env: RuntimeEnv) {
  const requested = (env.X_PROVIDER ?? "").toLowerCase();
  if (requested === "third_party") return { configured: Boolean(env.X_PROVIDER_BASE_URL), kind: "third_party" as const };
  if (requested === "public_source") return { configured: Boolean(env.X_PUBLIC_FEED_URL_TEMPLATE), kind: "public_source" as const };
  if (requested === "mock") return { configured: env.X_ALLOW_MOCK_INGEST === "true", kind: "mock" as const };
  return { configured: false, kind: null };
}

export function createXProvider(env: RuntimeEnv): XDataProvider | null {
  const status = getXProviderStatus(env);
  if (!status.configured || !status.kind) return null;
  if (status.kind === "third_party") return new ThirdPartyProvider(env);
  if (status.kind === "public_source") return new PublicSourceProvider(env);
  return new MockXProvider();
}
