import { CATEGORIES } from "@/lib/types";
import { ensureDatabase, getLatestSync, getTripPlan, listStories, saveTripPlan, type RuntimeEnv } from "@/lib/server/database";
import { askTripAssistant } from "@/lib/server/trip-assistant";
import {
  createBookingRequest,
  createPartner,
  listAllPartners,
  listVerifiedPartners,
  setPartnerStatus,
  PARTNER_KINDS,
  PARTNER_STATUSES,
  PRICING_MODELS,
  type PartnerKind,
  type PartnerService,
  type PartnerStatus,
  type PricingModel,
} from "@/lib/server/partners";
import { fetchMatchWeather } from "@/services/weather";
import { gbpToThb } from "@/lib/server/fx";
import {
  ensureFootballTables, getFixtures, getMatchBundle, getProviderHealth, getStandings, listFixtureChanges,
} from "@/lib/server/football";
import { leagueImpact } from "@/services/intelligence/leagueImpact";
import { buildMatchStory } from "@/services/intelligence/matchStory";
import { buildKeyMoments } from "@/services/intelligence/keyMoments";
import { controlScore } from "@/services/intelligence/controlScore";
import { linkStories, storiesForFixture } from "@/services/intelligence/newsMatch";
import { rankMatches, type MatchFitResult } from "@/services/intelligence/matchFit";
import { publishFinishedMatchReports } from "@/lib/server/match-reports";
import type { BudgetStyle } from "@/services/trip/types";
import type { GOGFixture } from "@/services/football/types";
import type { Story } from "@/lib/types";

import { DEFAULT_COMPETITION_ID, DEFAULT_SEASON } from "@/services/football/competitions";
import { generateDailyDigest, runIngest, translateStories } from "@/lib/server/pipeline";
import { getChannelAnalytics } from "@/lib/server/channel-analytics";
import {
  collectXWatchlist,
  createXAccount,
  deactivateXAccount,
  getXAccount,
  getXCollectorStatus,
  getXPost,
  listXAccounts,
  listXPosts,
  updateXAccount,
} from "@/lib/server/x/collector";
import { getXProviderStatus, X_USERNAME_PATTERN } from "@/lib/server/x/providers";

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

function noDatabase() {
  return json({ error: "Story storage is not configured." }, 503);
}

function adminAuthorizationError(request: Request, env: RuntimeEnv) {
  if (!env.CRON_SECRET) {
    return json({ error: "admin_not_configured", message: "Set CRON_SECRET before using X collector mutation endpoints." }, 503);
  }
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied !== env.CRON_SECRET) return json({ error: "unauthorized", message: "A valid bearer secret is required." }, 401);
  return null;
}

function numberParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function xPostFilters(url: URL, username?: string) {
  return {
    username: username ?? url.searchParams.get("username") ?? undefined,
    since: url.searchParams.get("since") ?? undefined,
    until: url.searchParams.get("until") ?? undefined,
    language: url.searchParams.get("language") ?? undefined,
    minLikes: numberParam(url, "min_likes"),
    minReposts: numberParam(url, "min_reposts"),
    limit: numberParam(url, "limit"),
    offset: numberParam(url, "offset"),
  };
}

function csvCell(value: unknown) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

/**
 * เชื่อมข่าวกับโปรแกรมแข่ง (STEP 71)
 * โปรแกรมมาจากแคชชุดเดียวกับ Match Center จึงไม่กินโควตาผู้ให้บริการเพิ่ม
 * ถ้าดึงโปรแกรมไม่ได้ (ยังไม่มีคีย์ ผู้ให้บริการล่ม) ให้ฟีดข่าวทำงานต่อโดยไม่มีลิงก์
 */
async function newsMatchLinks(env: RuntimeEnv, stories: Story[]) {
  try {
    if (env.DB) await ensureFootballTables(env.DB);
    const { fixtures } = await getFixtures(env, DEFAULT_COMPETITION_ID, DEFAULT_SEASON);
    return linkStories(stories, fixtures);
  } catch {
    return [];
  }
}

/** ข่าวที่เกี่ยวกับนัดนี้ — ย้อนหลัง 45 วันเพื่อให้ครอบคลุมช่วงก่อนเกมทั้งหมด */
async function newsForFixture(env: RuntimeEnv, fixture: GOGFixture) {
  if (!env.DB) return [];
  try {
    const stories = await listStories(env.DB, { days: 45, minCredibility: 0 });
    const links = storiesForFixture(linkStories(stories, [fixture]), fixture.id);
    return links.map((link) => {
      const story = stories.find((item) => item.id === link.storyId);
      return story ? { link, story } : null;
    }).filter((entry): entry is { link: typeof links[number]; story: Story } => entry !== null);
  } catch {
    return [];
  }
}

/** ย่อผลจัดอันดับให้เหลือเฉพาะที่การ์ดใช้ — ไม่ส่ง GOGFixture เต็มก้อน 380 ครั้ง */
function slimFit(result: MatchFitResult) {
  return {
    fixtureId: result.fixtureId,
    homeTh: result.fixture.home.nameTh,
    awayTh: result.fixture.away.nameTh,
    kickoffUtc: result.fixture.kickoffUtc,
    kickoffTimeAnnounced: result.fixture.kickoffTimeAnnounced,
    venue: result.fixture.venue?.name ?? null,
    matchweek: result.fixture.matchweek,
    worthScore: result.worthScore,
    highlights: result.highlights.slice(0, 4),
    best: result.best,
    verdict: result.verdict,
  };
}

function sourceCapabilities(env: RuntimeEnv) {
  const xProvider = getXProviderStatus(env);
  return {
    rss: true,
    newsApi: Boolean(env.NEWSAPI_KEY),
    x: xProvider.configured,
    xProvider: xProvider.kind,
    translation: Boolean(env.ANTHROPIC_API_KEY),
  };
}

export async function handleApi(request: Request, env: RuntimeEnv) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (!env.DB) return noDatabase();
  await ensureDatabase(env.DB);

  if (url.pathname === "/api/stories" && request.method === "GET") {
    const category = url.searchParams.get("category") ?? undefined;
    const minCredibility = Number(url.searchParams.get("minCredibility") ?? 0);
    const source = url.searchParams.get("source") ?? undefined;
    const stories = await listStories(env.DB, {
      days: Number(url.searchParams.get("days") ?? 14),
      category: category && CATEGORIES.includes(category as never) ? category : undefined,
      minCredibility: Number.isFinite(minCredibility) ? minCredibility : 0,
      source,
    });
    const lastSync = await getLatestSync(env.DB);
    // เชื่อมข่าวกับโปรแกรมแข่ง (STEP 71) — ผูกไม่ได้ก็ส่งลิสต์ว่าง ไม่ทำให้ฟีดข่าวพัง
    const matchLinks = await newsMatchLinks(env, stories);
    return json({ stories, lastSync, matchLinks, capabilities: sourceCapabilities(env) });
  }

  if (url.pathname === "/api/status" && request.method === "GET") {
    return json({ ok: true, lastSync: await getLatestSync(env.DB), sources: sourceCapabilities(env), channelAnalytics: Boolean(env.YOUTUBE_API_KEY) });
  }

  if (url.pathname === "/api/channel-analytics" && request.method === "GET") {
    return json(await getChannelAnalytics(env));
  }

  if (url.pathname === "/api/x/status" && request.method === "GET") {
    return json(await getXCollectorStatus(env.DB, env));
  }

  if (url.pathname === "/api/x/accounts") {
    if (request.method === "GET") return json({ accounts: await listXAccounts(env.DB) });
    if (request.method === "POST") {
      const authError = adminAuthorizationError(request, env);
      if (authError) return authError;
      try {
        const body = await request.json() as { username?: string; collection_interval_minutes?: number };
        if (!body.username || !X_USERNAME_PATTERN.test(body.username)) {
          return json({ error: "invalid_username", message: "Username may contain only letters, numbers, and underscores." }, 400);
        }
        const account = await createXAccount(env.DB, body.username, body.collection_interval_minutes ?? 30);
        return json({ account }, 201);
      } catch (error) {
        return json({ error: "invalid_request", message: error instanceof Error ? error.message : "Invalid JSON body." }, 400);
      }
    }
  }

  if (url.pathname === "/api/x/posts" && request.method === "GET") {
    return json({ posts: await listXPosts(env.DB, xPostFilters(url)) });
  }

  if (url.pathname === "/api/x/collect-all" && request.method === "POST") {
    const authError = adminAuthorizationError(request, env);
    if (authError) return authError;
    return json(await collectXWatchlist(env));
  }

  const xCollectMatch = url.pathname.match(/^\/api\/x\/collect\/([A-Za-z0-9_]+)$/);
  if (xCollectMatch && request.method === "POST") {
    const authError = adminAuthorizationError(request, env);
    if (authError) return authError;
    const username = xCollectMatch[1];
    if (!X_USERNAME_PATTERN.test(username)) return json({ error: "Invalid X username." }, 400);
    return json(await collectXWatchlist(env, username));
  }

  const xAccountPostsMatch = url.pathname.match(/^\/api\/x\/accounts\/([A-Za-z0-9_]+)\/posts$/);
  if (xAccountPostsMatch && request.method === "GET") {
    const username = xAccountPostsMatch[1];
    if (!await getXAccount(env.DB, username)) return json({ error: "account_not_found", message: "X account was not found." }, 404);
    return json({ posts: await listXPosts(env.DB, xPostFilters(url, username)) });
  }

  const xAccountMatch = url.pathname.match(/^\/api\/x\/accounts\/([A-Za-z0-9_]+)$/);
  if (xAccountMatch) {
    const username = xAccountMatch[1];
    if (request.method === "GET") {
      const account = await getXAccount(env.DB, username);
      return account ? json({ account }) : json({ error: "account_not_found", message: "X account was not found." }, 404);
    }
    const authError = adminAuthorizationError(request, env);
    if (authError) return authError;
    if (request.method === "DELETE") {
      const account = await deactivateXAccount(env.DB, username);
      return account ? json({ account }) : json({ error: "account_not_found", message: "X account was not found." }, 404);
    }
    if (request.method === "PATCH") {
      try {
        const body = await request.json() as { is_active?: boolean; collection_interval_minutes?: number };
        const account = await updateXAccount(env.DB, username, {
          isActive: body.is_active,
          collectionIntervalMinutes: body.collection_interval_minutes,
        });
        return account ? json({ account }) : json({ error: "account_not_found", message: "X account was not found." }, 404);
      } catch {
        return json({ error: "invalid_request", message: "Invalid JSON body." }, 400);
      }
    }
  }

  const xPostMatch = url.pathname.match(/^\/api\/x\/posts\/(\d+)$/);
  if (xPostMatch && request.method === "GET") {
    const post = await getXPost(env.DB, Number(xPostMatch[1]));
    return post ? json({ post }) : json({ error: "post_not_found", message: "X post was not found." }, 404);
  }

  if (url.pathname === "/api/x/search" && request.method === "GET") {
    return json({ error: "search_not_supported", message: "The active X provider does not support public post search." }, 501);
  }

  if ((url.pathname === "/api/x/export/posts.json" || url.pathname === "/api/x/export/posts.csv") && request.method === "GET") {
    const posts = await listXPosts(env.DB, { ...xPostFilters(url), limit: 100 });
    if (url.pathname.endsWith(".json")) {
      return new Response(JSON.stringify({ posts }, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": "attachment; filename=\"gog-x-posts.json\"",
          "cache-control": "no-store",
        },
      });
    }
    const columns = ["id", "platform_post_id", "username", "post_url", "text", "post_created_at", "reply_count", "repost_count", "like_count", "quote_count", "view_count", "language", "source", "collected_at"];
    const rows = posts.map((post) => {
      const record = post as Record<string, unknown>;
      return columns.map((column) => csvCell(record[column])).join(",");
    });
    return new Response(`\uFEFF${columns.join(",")}\n${rows.join("\n")}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"gog-x-posts.csv\"",
        "cache-control": "no-store",
      },
    });
  }

  if (url.pathname === "/api/ingest" && (request.method === "POST" || request.method === "GET")) {
    if (request.method === "GET" && env.CRON_SECRET) {
      const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
      if (supplied !== env.CRON_SECRET) return json({ error: "Unauthorized" }, 401);
    }
    try {
      return json({ ok: true, ...(await runIngest(env)) });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Ingestion failed" }, 502);
    }
  }

  // ── อากาศวันแข่ง (Open-Meteo · ฟรี ไม่ต้องใช้คีย์) ────────────────────
  if (url.pathname === "/api/weather" && request.method === "GET") {
    const city = url.searchParams.get("city") ?? "";
    const date = url.searchParams.get("date") ?? "";
    const weather = await fetchMatchWeather(city, date);
    return json(weather ? { ok: true, weather } : { ok: false, error: "unavailable" }, weather ? 200 : 404);
  }

  // ── อัตราแลกเปลี่ยน GBP → THB (STEP 43) ──────────────────────────────
  // ค่าธรรมเนียมวีซ่าเป็นปอนด์ หน้าเว็บจึงต้องได้เรตจริงมาคิดเป็นบาท
  // แคชฝั่ง Cloudflare 6 ชม. · cache-control ให้เบราว์เซอร์เก็บได้ 1 ชม.
  if (url.pathname === "/api/fx" && request.method === "GET") {
    return json({ ok: true, ...(await gbpToThb()) }, 200, { "cache-control": "public, max-age=3600" });
  }

  // ── GOG FOOTBALL MATCH CENTER (STEP 8) ───────────────────────────────
  // เบราว์เซอร์คุยกับ endpoint พวกนี้เท่านั้น ไม่เคยเห็นคีย์หรือ payload ดิบของผู้ให้บริการ
  if (url.pathname === "/api/football/fixtures" && request.method === "GET") {
    if (env.DB) await ensureFootballTables(env.DB);
    const competition = url.searchParams.get("competition") ?? DEFAULT_COMPETITION_ID;
    const season = url.searchParams.get("season") ?? DEFAULT_SEASON;
    const result = await getFixtures(env, competition, season);
    // ส่งการเปลี่ยนแปลงตารางแข่งไปด้วย เพื่อให้การ์ดติดป้ายได้โดยไม่ต้องยิงซ้ำ
    return json({ ok: true, ...result, changes: await listFixtureChanges(env) });
  }

  if (url.pathname === "/api/football/standings" && request.method === "GET") {
    if (env.DB) await ensureFootballTables(env.DB);
    const competition = url.searchParams.get("competition") ?? DEFAULT_COMPETITION_ID;
    const season = url.searchParams.get("season") ?? DEFAULT_SEASON;
    return json({ ok: true, ...(await getStandings(env, competition, season)) });
  }

  const matchMatch = url.pathname.match(/^\/api\/football\/match\/([A-Za-z0-9_-]+)$/);
  if (matchMatch && request.method === "GET") {
    if (env.DB) await ensureFootballTables(env.DB);
    const competition = url.searchParams.get("competition") ?? DEFAULT_COMPETITION_ID;
    const season = url.searchParams.get("season") ?? DEFAULT_SEASON;
    const bundle = await getMatchBundle(env, matchMatch[1], competition, season);
    if (!bundle) return json({ ok: false, error: "fixture_not_found" }, 404);
    const changes = (await listFixtureChanges(env)).filter((change) => change.fixtureId === bundle.fixture.id);
    return json({
      ok: true,
      bundle,
      story: buildMatchStory(bundle.fixture, bundle.teamStats, bundle.events),
      keyMoments: buildKeyMoments(bundle.fixture, bundle.events),
      control: controlScore(
        bundle.teamStats.find((row) => row.teamId === bundle.fixture.home.id),
        bundle.teamStats.find((row) => row.teamId === bundle.fixture.away.id),
      ),
      impact: leagueImpact(bundle.fixture, bundle.standings),
      changes,
      news: await newsForFixture(env, bundle.fixture),
    });
  }

  // แมตช์ไหนเหมาะกับผม (STEP 73) — กรอกข้อจำกัด แล้วไล่ทั้งลีกให้
  if (url.pathname === "/api/football/match-fit" && request.method === "POST") {
    if (env.DB) await ensureFootballTables(env.DB);
    let body: Record<string, unknown> = {};
    try { body = (await request.json()) as Record<string, unknown>; } catch { return json({ error: "invalid_body" }, 400); }

    const leaveDaysAvailable = Math.max(0, Math.min(Number(body.leaveDaysAvailable) || 0, 60));
    const budgetPerPerson = Math.max(0, Math.min(Number(body.budgetPerPerson) || 0, 5_000_000));
    const budget = ["saver", "comfort", "premium"].includes(String(body.budget)) ? String(body.budget) as BudgetStyle : "comfort";
    const earliestDeparture = /^\d{4}-\d{2}-\d{2}$/.test(String(body.earliestDeparture))
      ? String(body.earliestDeparture)
      : new Date().toISOString().slice(0, 10);
    // จำกัดจำนวนช่วงห้ามเดินทาง เพราะทุกช่วงต้องเทียบกับทุกนัด × ทุกความยาวทริป
    const blackouts = (Array.isArray(body.blackouts) ? body.blackouts : []).slice(0, 20)
      .map((entry) => entry as Record<string, unknown>)
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry.from)) && /^\d{4}-\d{2}-\d{2}$/.test(String(entry.to)))
      .map((entry) => ({
        from: String(entry.from),
        to: String(entry.to),
        label: typeof entry.label === "string" ? entry.label.slice(0, 60) : undefined,
      }));

    const competition = typeof body.competition === "string" ? body.competition : DEFAULT_COMPETITION_ID;
    const season = typeof body.season === "string" ? body.season : DEFAULT_SEASON;
    const { fixtures, demo } = await getFixtures(env, competition, season);
    const report = rankMatches(fixtures, { leaveDaysAvailable, budgetPerPerson, budget, blackouts, earliestDeparture });

    // ส่งเฉพาะที่หน้าเว็บใช้จริง — payload เต็มของ 380 นัดใหญ่เกินจำเป็น
    return json({
      ok: true,
      demo,
      version: report.version,
      totalFixtures: fixtures.length,
      fitCount: report.fits.length,
      fits: report.fits.slice(0, 30).map(slimFit),
      misses: report.misses.slice(0, 12).map(slimFit),
      unlockByLeave: report.unlockByLeave,
      unlockByBudget: report.unlockByBudget,
    });
  }

  // สั่งปล่อยรายงานผลบอลด้วยมือ (STEP 45) — ปกติ cron ทำให้ทุก 10 นาที
  // ต้องมี CRON_SECRET เพราะเขียนข่าวลงคลังจริง
  if (url.pathname === "/api/football/match-reports" && request.method === "POST") {
    const denied = adminAuthorizationError(request, env);
    if (denied) return denied;
    if (env.DB) await ensureFootballTables(env.DB);
    return json({ ok: true, ...(await publishFinishedMatchReports(env)) });
  }

  // สุขภาพผู้ให้บริการ — ต้องมี CRON_SECRET เพราะเผยรายละเอียดภายใน (STEP 93, 118)
  if (url.pathname === "/api/football/health" && request.method === "GET") {
    const denied = adminAuthorizationError(request, env);
    if (denied) return denied;
    return json({ ok: true, ...(await getProviderHealth(env)) });
  }

  // ── GOG Partner Network ──────────────────────────────────────────────
  // สมัครเป็นผู้ให้บริการ — ทุกคนเข้าสถานะ pending รอทีมงานตรวจ
  if (url.pathname === "/api/partners" && request.method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = (await request.json()) as Record<string, unknown>; } catch { return json({ error: "invalid_body" }, 400); }

    const text = (key: string, max = 400) => (typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "");
    const kind = text("kind") as PartnerKind;
    if (!PARTNER_KINDS.includes(kind)) return json({ error: "invalid_kind" }, 400);
    const displayName = text("displayName", 120);
    const city = text("city", 60);
    const email = text("email", 160);
    if (!displayName || !city) return json({ error: "name_and_city_required" }, 400);
    if (!email && !text("phone") && !text("lineId")) return json({ error: "contact_required" }, 400);

    const list = (key: string) => (Array.isArray(body[key])
      ? (body[key] as unknown[]).filter((item): item is string => typeof item === "string").slice(0, 12)
      : []);

    const rawServices = Array.isArray(body.services) ? (body.services as Record<string, unknown>[]).slice(0, 8) : [];
    const services: PartnerService[] = rawServices.flatMap((service, index) => {
      const title = typeof service.title === "string" ? service.title.trim().slice(0, 160) : "";
      if (!title) return [];
      const pricingModel = (PRICING_MODELS as readonly string[]).includes(String(service.pricingModel))
        ? (service.pricingModel as PricingModel)
        : "per_day";
      return [{
        id: `svc_${index}`,
        title,
        pricingModel,
        priceThb: Math.max(0, Math.round(Number(service.priceThb) || 0)),
        capacity: Math.min(Math.max(Math.round(Number(service.capacity) || 1), 1), 60),
        matchdayReady: service.matchdayReady === true,
        notes: typeof service.notes === "string" ? service.notes.trim().slice(0, 400) : "",
      }];
    });

    const rawVehicle = body.vehicle as Record<string, unknown> | undefined;
    const vehicle = kind === "driver" && rawVehicle && typeof rawVehicle.model === "string"
      ? {
          make: String(rawVehicle.make ?? "").slice(0, 60),
          model: String(rawVehicle.model).slice(0, 60),
          year: Math.min(Math.max(Math.round(Number(rawVehicle.year) || 0), 1980), 2100),
          seats: Math.min(Math.max(Math.round(Number(rawVehicle.seats) || 4), 1), 60),
          luggage: Math.min(Math.max(Math.round(Number(rawVehicle.luggage) || 0), 0), 30),
        }
      : null;

    const created = await createPartner(env.DB, {
      kind,
      displayName,
      legalName: text("legalName", 160),
      city,
      areas: list("areas"),
      languages: list("languages"),
      bio: text("bio", 1_200),
      email,
      phone: text("phone", 60),
      lineId: text("lineId", 80),
      vehicle,
      services,
    });
    return json({ ok: true, ...created });
  }

  // รายชื่อสาธารณะ — เฉพาะที่ตรวจแล้ว และไม่ส่งช่องทางติดต่อออกไป
  if (url.pathname === "/api/partners" && request.method === "GET") {
    const city = url.searchParams.get("city") ?? undefined;
    const kindParam = url.searchParams.get("kind");
    const kind = kindParam && PARTNER_KINDS.includes(kindParam as PartnerKind) ? (kindParam as PartnerKind) : undefined;
    return json({ ok: true, partners: await listVerifiedPartners(env.DB, { city, kind }) });
  }

  // หน้าตรวจสอบของทีมงาน — ต้องมี CRON_SECRET
  if (url.pathname === "/api/partners/admin" && request.method === "GET") {
    const denied = adminAuthorizationError(request, env);
    if (denied) return denied;
    return json({ ok: true, partners: await listAllPartners(env.DB) });
  }

  const partnerStatusMatch = url.pathname.match(/^\/api\/partners\/(ptn_[a-z0-9]+)\/status$/);
  if (partnerStatusMatch && request.method === "POST") {
    const denied = adminAuthorizationError(request, env);
    if (denied) return denied;
    let body: { status?: unknown } = {};
    try { body = (await request.json()) as typeof body; } catch { return json({ error: "invalid_body" }, 400); }
    const status = String(body.status) as PartnerStatus;
    if (!PARTNER_STATUSES.includes(status)) return json({ error: "invalid_status" }, 400);
    return json({ ok: true, ...(await setPartnerStatus(env.DB, partnerStatusMatch[1], status)) });
  }

  // คำขอจอง — โหมดไดเรกทอรี ระบบแค่ส่งต่อคำขอ ไม่รับเงิน
  if (url.pathname === "/api/bookings" && request.method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = (await request.json()) as Record<string, unknown>; } catch { return json({ error: "invalid_body" }, 400); }
    const str = (key: string, max = 300) => (typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "");
    const partnerId = str("partnerId", 40);
    const travellerName = str("travellerName", 120);
    const travellerContact = str("travellerContact", 200);
    const serviceDate = str("serviceDate", 10);
    if (!partnerId || !travellerName || !travellerContact || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      return json({ error: "missing_fields" }, 400);
    }
    return json({ ok: true, ...(await createBookingRequest(env.DB, {
      partnerId,
      serviceId: str("serviceId", 40),
      tripId: str("tripId", 40),
      travellerName,
      travellerContact,
      serviceDate,
      pax: Math.min(Math.max(Math.round(Number(body.pax) || 1), 1), 60),
      message: str("message", 800),
    })) });
  }

  // ── ทริปที่บันทึกไว้ (STEP 27) ───────────────────────────────────────
  if (url.pathname === "/api/trips" && request.method === "POST") {
    let body: { id?: unknown; title?: unknown; payload?: unknown } = {};
    try { body = (await request.json()) as typeof body; } catch { return json({ error: "invalid_body" }, 400); }
    if (!body.payload || typeof body.payload !== "object") return json({ error: "payload_required" }, 400);
    // id สั้นพอให้พิมพ์ตามได้ และสุ่มพอให้เดาไม่ถูก
    const id = typeof body.id === "string" && /^[a-z0-9]{6,24}$/.test(body.id)
      ? body.id
      : Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((byte) => byte.toString(36).padStart(2, "0"))
          .join("")
          .slice(0, 10);
    const title = typeof body.title === "string" ? body.title : "";
    return json({ ok: true, ...(await saveTripPlan(env.DB, id, title, body.payload)) });
  }

  const tripMatch = url.pathname.match(/^\/api\/trips\/([a-z0-9]{6,24})$/);
  if (tripMatch && request.method === "GET") {
    const plan = await getTripPlan(env.DB, tripMatch[1]);
    if (!plan) return json({ error: "not_found" }, 404);
    return json({ ok: true, ...plan });
  }

  // ── ASK GOG · ผู้ช่วยปรับทริป (STEP 39) ──────────────────────────────
  if (url.pathname === "/api/trip-assistant" && request.method === "POST") {
    let body: { question?: unknown; trip?: unknown; catalogue?: unknown } = {};
    try { body = (await request.json()) as typeof body; } catch { return json({ error: "invalid_body" }, 400); }
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 600) : "";
    if (!question) return json({ error: "question_required" }, 400);
    try {
      const result = await askTripAssistant(env, {
        question,
        trip: body.trip ?? {},
        catalogue: body.catalogue ?? {},
      });
      if ("error" in result) {
        const status = result.error === "assistant_not_configured" ? 503 : 502;
        return json({ ok: false, ...result }, status);
      }
      return json({ ok: true, ...result });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "assistant_failed" }, 502);
    }
  }

  // 🇹🇭 แปลไทยตามคำสั่ง — ผู้ใช้กดปุ่มบนหน้าเว็บเท่านั้น ครอนไม่เรียก
  // body: { ids?: string[], force?: boolean, limit?: number } · ผลลัพธ์บันทึกลง D1 แล้ว
  if (url.pathname === "/api/translate" && request.method === "POST") {
    let body: { ids?: unknown; force?: unknown; limit?: unknown } = {};
    try { body = (await request.json()) as typeof body; } catch { /* ไม่มี body = แปลข่าวที่ยังค้างอยู่ */ }
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : undefined;
    try {
      const result = await translateStories(env, {
        ids,
        force: body.force === true,
        limit: typeof body.limit === "number" ? body.limit : undefined,
      });
      if ("error" in result && result.error === "translation_not_configured") {
        return json({ ok: false, error: result.error, message: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บน Worker" }, 503);
      }
      return json({ ok: true, ...result });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Translation failed" }, 502);
    }
  }

  if ((url.pathname === "/api/digest" || url.pathname === "/api/digest/export") && request.method === "GET") {
    const digest = await generateDailyDigest(env, url.searchParams.get("date") ?? undefined);
    if (url.pathname.endsWith("/export")) {
      return new Response(digest.contentTh, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": `attachment; filename="gog-digest-${digest.date}.txt"`,
          "cache-control": "no-store",
        },
      });
    }
    return json({ digest });
  }

  return json({ error: "Not found" }, 404);
}
