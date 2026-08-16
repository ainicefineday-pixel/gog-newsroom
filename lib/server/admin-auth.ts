// การเข้าสู่ระบบของแอดมิน
// ---------------------------------------------------------------------------
// ก่อนหน้านี้การแก้อะไรบนเว็บต้องพิมพ์ CRON_SECRET ดิบ ๆ ลงในกล่องบนหน้าเว็บ
// แล้วเบราว์เซอร์ก็ถือความลับตัวนั้นไว้ ใครเปิด devtools ก็อ่านได้ และความลับ
// ตัวเดียวกันนี้ยังใช้กับครอนอีก
//
// ตอนนี้กรอกชื่อผู้ใช้กับรหัสผ่านที่หน้า /admin แล้วเซิร์ฟเวอร์ออก "ตั๋ว" ให้
// เก็บในคุกกี้แบบ httpOnly ซึ่ง JavaScript อ่านไม่ได้ ตั๋วมีอายุจำกัดและ
// ปลอมไม่ได้เพราะเซ็นด้วย HMAC-SHA256 รหัสผ่านจริงไม่เคยถูกส่งซ้ำหลังล็อกอิน
// และไม่เคยถูกเก็บไว้ในเบราว์เซอร์เลย

import type { RuntimeEnv } from "@/lib/server/database";

export const ADMIN_COOKIE = "gog_admin";
const SESSION_HOURS = 12;

/** ความลับที่ใช้เซ็นตั๋ว — แยกได้ ถ้าไม่แยกก็ใช้ของครอนไปก่อน */
function signingSecret(env: RuntimeEnv): string | null {
  return env.ADMIN_SESSION_SECRET || env.CRON_SECRET || env.ADMIN_PASSWORD || null;
}

/** เทียบสตริงแบบไม่แพ้ทางเวลา — กันการเดารหัสทีละตัวจากเวลาที่ตอบกลับ */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return base64Url(new Uint8Array(signature));
}

export type AdminLoginResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; status: number; error: string; message: string };

/**
 * ตรวจชื่อผู้ใช้กับรหัสผ่าน แล้วออกตั๋วให้
 *
 * ไม่ได้ตั้ง ADMIN_USERNAME/ADMIN_PASSWORD ไว้ = ปิดการล็อกอินทั้งหมด ไม่ใช่
 * ปล่อยผ่าน — ระบบที่ยังตั้งค่าไม่เสร็จต้องเข้าไม่ได้ ไม่ใช่เข้าได้ฟรี
 */
export async function login(
  env: RuntimeEnv,
  username: string,
  password: string,
): Promise<AdminLoginResult> {
  const secret = signingSecret(env);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !secret) {
    return {
      ok: false,
      status: 503,
      error: "admin_not_configured",
      message: "ยังไม่ได้ตั้ง ADMIN_USERNAME และ ADMIN_PASSWORD บน Worker",
    };
  }

  // ตรวจทั้งสองช่องเสมอ ไม่ลัดวงจรเมื่อชื่อผู้ใช้ผิด เพื่อไม่ให้เดาได้จากเวลา
  // ว่าชื่อผู้ใช้ไหนมีอยู่จริง
  const userOk = timingSafeEqual(username, env.ADMIN_USERNAME);
  const passOk = timingSafeEqual(password, env.ADMIN_PASSWORD);
  if (!userOk || !passOk) {
    return {
      ok: false,
      status: 401,
      error: "invalid_credentials",
      message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    };
  }

  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  const payload = `${env.ADMIN_USERNAME}|${expiresAt}`;
  return { ok: true, token: `${payload}|${await sign(payload, secret)}`, expiresAt };
}

/** ตั๋วนี้ใช้ได้อยู่ไหม — เซ็นถูก ยังไม่หมดอายุ และเป็นของผู้ใช้คนปัจจุบัน */
export async function verifySession(
  env: RuntimeEnv,
  token: string | null | undefined,
): Promise<boolean> {
  const secret = signingSecret(env);
  if (!token || !secret || !env.ADMIN_USERNAME) return false;

  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const [username, expiresAt, signature] = parts as [string, string, string];

  if (!timingSafeEqual(username, env.ADMIN_USERNAME)) return false;
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  return timingSafeEqual(await sign(`${username}|${expiresAt}`, secret), signature);
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * คุกกี้ตั๋วแอดมิน
 *
 * httpOnly เพื่อให้สคริปต์บนหน้าเว็บอ่านไม่ได้ · Secure เพราะเว็บอยู่บน https
 * · SameSite=Strict กันเว็บอื่นยิงคำสั่งแทนเราขณะที่เรายังล็อกอินค้างอยู่
 */
export function sessionCookie(token: string, maxAgeSec: number): string {
  return [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${maxAgeSec}`,
  ].join("; ");
}

export function clearedCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export const SESSION_MAX_AGE_SEC = SESSION_HOURS * 3600;
