import { CATEGORIES } from "@/lib/types";
import { ensureDatabase, getLatestSync, listStories, type RuntimeEnv } from "@/lib/server/database";
import { generateDailyDigest, runIngest } from "@/lib/server/pipeline";

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

function noDatabase() {
  return json({ error: "Story storage is not configured." }, 503);
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
    return json({ stories, lastSync });
  }

  if (url.pathname === "/api/status" && request.method === "GET") {
    return json({ ok: true, lastSync: await getLatestSync(env.DB), sources: { rss: true, newsApi: Boolean(env.NEWSAPI_KEY), x: Boolean(env.X_BEARER_TOKEN), translation: Boolean(env.ANTHROPIC_API_KEY) } });
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

