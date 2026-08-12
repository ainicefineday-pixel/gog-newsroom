/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleApi } from "../lib/server/api";
import { maybeGenerateMorningDigest, runIngest } from "../lib/server/pipeline";
import { publishFinishedMatchReports } from "../lib/server/match-reports";
import { applyStoryMerges, decideStoryMerges } from "../lib/server/story-merge";
import type { RuntimeEnv } from "../lib/server/database";

interface Env extends RuntimeEnv {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

// Static assets are served before this Worker ever runs, so the track is offered
// on a path that is deliberately not an asset. The bytes still come from the
// asset store underneath.
const ANTHEM_PATH = "/media/anthem.mp3";
const ANTHEM_ASSET = "/gog-anthem.mp3";
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

function rangeNotSatisfiable(total: number, headers: Headers) {
  headers.set("Content-Range", `bytes */${total}`);
  headers.delete("Content-Length");
  return new Response(null, { status: 416, headers });
}

// The static asset server answers every request with a plain 200, and iOS Safari
// refuses to start a media element unless its opening range probe comes back as
// a 206. Serving the track through here restores that contract.
async function serveAnthem(request: Request, env: Env): Promise<Response> {
  const asset = await env.ASSETS.fetch(new Request(new URL(ANTHEM_ASSET, request.url)));
  if (!asset.ok) return asset;

  const headers = new Headers(asset.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=604800");

  const rangeHeader = request.headers.get("Range");
  const match = rangeHeader ? RANGE_PATTERN.exec(rangeHeader.trim()) : null;
  if (!match) return new Response(asset.body, { status: 200, headers });

  const buffer = await asset.arrayBuffer();
  const total = buffer.byteLength;
  const [, rawStart, rawEnd] = match;

  let start: number;
  let end: number;
  if (rawStart === "") {
    // A suffix range asks for the final N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return rangeNotSatisfiable(total, headers);
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? total - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
    return rangeNotSatisfiable(total, headers);
  }
  end = Math.min(end, total - 1);

  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(buffer.slice(start, end + 1), { status: 206, headers });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === ANTHEM_PATH) return serveAnthem(request, env);

    const apiResponse = await handleApi(request, env);
    if (apiResponse) return apiResponse;

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runIngest(env)
        // ใช้คำตัดสินเดิมก่อน ไม่ให้ข่าวที่เคยยุบแล้วซึ่งเพิ่งถูกเขียนกลับมา
        // หลุดเข้าไปเป็นตัวหลักของกลุ่มใหม่จนเกิดสาย A → B → C
        .then(() => applyStoryMerges(env).catch(() => undefined))
        // ตัดสินกลุ่มใหม่วันละ 3 ครั้ง แล้วใช้ผลรอบนี้ทันที
        .then(() => decideStoryMerges(env).catch(() => undefined))
        .then(() => applyStoryMerges(env).catch(() => undefined))
        .then(() => maybeGenerateMorningDigest(env))
        // รายงานผลบอลอัตโนมัติ (STEP 45) — ต่อท้ายรอบเดิม ไม่ต้องตั้ง cron แยก
        // catch ไว้เพราะผู้ให้บริการฟุตบอลล่มไม่ควรทำให้การดึงข่าวรอบนี้ถือว่าล้มเหลว
        .then(() => publishFinishedMatchReports(env).catch(() => undefined))
        .then(() => undefined),
    );
  },
};

export default worker;
