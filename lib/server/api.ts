import { CATEGORIES } from "@/lib/types";
import { ensureDatabase, getLatestSync, listStories, type RuntimeEnv } from "@/lib/server/database";
import { generateDailyDigest, runIngest } from "@/lib/server/pipeline";
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
    return json({ stories, lastSync, capabilities: sourceCapabilities(env) });
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
