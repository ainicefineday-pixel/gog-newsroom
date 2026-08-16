// ค่าที่บรรณาธิการตั้งได้จากหน้าเว็บ
// ---------------------------------------------------------------------------
// เดิมคลิปปักหมุดอยู่ในไฟล์ config ซึ่งแปลว่าเปลี่ยนคลิปทีต้องแก้โค้ด สั่ง build
// แล้ว deploy ใหม่ทั้งเว็บ — ช้าเกินไปสำหรับของที่ควรเปลี่ยนได้ทุกวัน
//
// ย้ายมาเก็บใน D1 แทน แก้จากหน้า /admin แล้วมีผลทันทีโดยไม่ต้อง deploy และ
// เครื่องไหน clone repo ไปก็เห็นค่าเดียวกัน เพราะค่าอยู่ที่ฐานข้อมูล ไม่ได้อยู่
// ในเครื่องใครคนใดคนหนึ่ง
//
// ค่าตั้งต้น (SEED_CLIP ข้างล่าง) ใช้เฉพาะตอนที่ยังไม่เคยมีใครกดบันทึกอะไรเลย
// ฐานข้อมูลชนะเสมอเมื่อมีค่า

import type { RuntimeEnv } from "@/lib/server/database";

export type FeaturedClip = {
  src: string;
  poster: string;
  title: string;
  description: string;
  /** วินาที — บอกผู้อ่านล่วงหน้าว่าคลิปยาวแค่ไหน */
  durationSec: number;
  /** ป้ายมุมบนซ้าย บอกว่าทำไมคลิปนี้ถึงได้อยู่ตรงนี้ */
  badge: string;
};

/**
 * คลิปที่ปักไว้ตั้งแต่แรกก่อนมีใครกดแก้อะไร
 *
 * อยู่ในโค้ดเพราะมันคือค่าเริ่มต้นของระบบ ไม่ใช่ค่าที่บรรณาธิการตั้ง — พอมีการ
 * บันทึกจากหน้า /admin ครั้งแรก ฐานข้อมูลจะชนะตลอดไป
 */
const SEED_CLIP: FeaturedClip = {
  src: "/featured/gog-featured.mp4",
  poster: "/featured/gog-featured.jpg",
  title: "GOG ลงพื้นที่ — ภาพจากขอบสนาม",
  description: "คลิปแนวตั้งจากทีมงาน GOG ถ่ายเอง ตัดเอง ไม่ได้หยิบมาจากช่องไหน",
  durationSec: 46,
  badge: "ปักหมุด",
};

const FEATURED_CLIP_KEY = "featured_clip";
const STUDIO_URL_KEY = "studio_url";

/**
 * ที่อยู่ของแอดมิน GROUND CALL
 *
 * สตูดิโอเป็นคนละแอปคนละเครื่อง ที่อยู่จึงต่างกันไปตามเครื่องที่รันอยู่ และจะ
 * เปลี่ยนอีกครั้งเมื่อวันหนึ่งมันถูก deploy ขึ้นโดเมนจริง เก็บไว้ในฐานข้อมูลให้
 * แก้จากหน้าเว็บได้ ดีกว่าฝังไว้ในโค้ดแล้วต้อง deploy ใหม่ทุกครั้งที่ย้ายเครื่อง
 */
const DEFAULT_STUDIO_URL = "http://localhost:3003";

export async function getStudioUrl(env: RuntimeEnv): Promise<string> {
  return (await readSetting<string>(env, STUDIO_URL_KEY)) ?? DEFAULT_STUDIO_URL;
}

export async function setStudioUrl(env: RuntimeEnv, value: unknown): Promise<string> {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SettingsError("ที่อยู่สตูดิโอต้องไม่ว่าง");
  }
  // ตัด / ท้ายออก เพราะเมนูต่อ path เข้าไปเอง ไม่งั้นจะได้ //login
  const trimmed = value.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SettingsError("ที่อยู่สตูดิโอไม่ใช่ลิงก์ที่ใช้ได้");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SettingsError("ที่อยู่สตูดิโอต้องเป็น http หรือ https");
  }
  await writeSetting(env, STUDIO_URL_KEY, trimmed);
  return trimmed;
}

export async function ensureSettingsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
}

async function readSetting<T>(env: RuntimeEnv, key: string): Promise<T | null> {
  if (!env.DB) return null;
  await ensureSettingsTable(env.DB);
  const row = await env.DB
    .prepare("SELECT value_json FROM site_settings WHERE key = ?")
    .bind(key)
    .first<{ value_json: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return null;
  }
}

async function writeSetting(env: RuntimeEnv, key: string, value: unknown) {
  await ensureSettingsTable(env.DB!);
  await env.DB!
    .prepare(
      `INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    )
    .bind(key, JSON.stringify(value), new Date().toISOString())
    .run();
}

export class SettingsError extends Error {}

function requireHttpUrlOrPath(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SettingsError(`${field} ต้องไม่ว่าง`);
  }
  const trimmed = value.trim();
  // เส้นทางในเว็บเราเองใช้ได้ (เช่น /featured/clip.mp4) ส่วนลิงก์ภายนอกต้องเป็น
  // http หรือ https เท่านั้น กัน javascript: หลุดเข้ามาเป็น src ของวิดีโอ
  if (trimmed.startsWith("/")) return trimmed;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SettingsError(`${field} ไม่ใช่ลิงก์ที่ใช้ได้`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SettingsError(`${field} ต้องเป็น http หรือ https`);
  }
  return parsed.toString();
}

/** ตรวจรูปร่างที่รับมาจากฟอร์มก่อนเก็บ — ฟอร์มพังไม่ควรทำให้หน้าแรกพัง */
export function parseFeaturedClip(raw: unknown): FeaturedClip {
  if (!raw || typeof raw !== "object") throw new SettingsError("ต้องส่งข้อมูลมาเป็น object");
  const input = raw as Record<string, unknown>;

  const text = (field: string, max: number, required = true) => {
    const value = input[field];
    if (typeof value !== "string" || value.trim() === "") {
      if (required) throw new SettingsError(`${field} ต้องไม่ว่าง`);
      return "";
    }
    return value.trim().slice(0, max);
  };

  const durationSec = Number(input.durationSec);
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 3600) {
    throw new SettingsError("ความยาวต้องเป็นวินาทีระหว่าง 1 ถึง 3600");
  }

  return {
    src: requireHttpUrlOrPath(input.src, "ลิงก์วิดีโอ"),
    poster: requireHttpUrlOrPath(input.poster, "ลิงก์ภาพปก"),
    title: text("title", 200),
    description: text("description", 500, false),
    durationSec: Math.round(durationSec),
    badge: text("badge", 40, false) || "ปักหมุด",
  };
}

/** คลิปที่หน้าแรกควรโชว์ — ฐานข้อมูลก่อน ถ้ายังไม่เคยตั้งค่อยใช้ของในโค้ด */
export async function getFeaturedClip(env: RuntimeEnv): Promise<FeaturedClip | null> {
  const stored = await readSetting<FeaturedClip | { cleared: true }>(
    env,
    FEATURED_CLIP_KEY,
  );
  if (stored && "cleared" in stored) return null;
  return stored ?? SEED_CLIP;
}

export async function setFeaturedClip(env: RuntimeEnv, clip: FeaturedClip) {
  await writeSetting(env, FEATURED_CLIP_KEY, clip);
  return clip;
}

/**
 * เอาคลิปปักหมุดออก
 *
 * เก็บเป็น { cleared: true } แทนการลบแถวทิ้ง เพราะการลบแถวแปลว่า "ยังไม่เคย
 * ตั้งค่า" ซึ่งจะทำให้ค่าตั้งต้นในโค้ดกลับมาโผล่เอง — ตรงข้ามกับที่สั่งไว้
 */
export async function clearFeaturedClip(env: RuntimeEnv) {
  await writeSetting(env, FEATURED_CLIP_KEY, { cleared: true });
}
