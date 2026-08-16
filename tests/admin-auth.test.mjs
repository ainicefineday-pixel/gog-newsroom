// การเข้าสู่ระบบของแอดมิน
// ---------------------------------------------------------------------------
// ตรวจสิ่งที่พังแล้วเสียหายจริง: ตั๋วปลอมใช้ไม่ได้ ตั๋วหมดอายุใช้ไม่ได้ และ
// ระบบที่ยังตั้งค่าไม่เสร็จต้องเข้าไม่ได้ ไม่ใช่เข้าได้ฟรี

import assert from "node:assert/strict";
import test from "node:test";
import {
  login,
  verifySession,
  readCookie,
  sessionCookie,
  ADMIN_COOKIE,
} from "../lib/server/admin-auth.ts";
import { parseFeaturedClip, SettingsError } from "../lib/server/site-settings.ts";

const ENV = {
  ADMIN_USERNAME: "gog",
  ADMIN_PASSWORD: "รหัสผ่านที่ยาวพอสมควร",
  ADMIN_SESSION_SECRET: "signing-secret",
};

test("ล็อกอินถูกต้องได้ตั๋วที่ใช้ได้จริง", async () => {
  const result = await login(ENV, "gog", "รหัสผ่านที่ยาวพอสมควร");
  assert.equal(result.ok, true);
  assert.equal(await verifySession(ENV, result.token), true);
  assert.ok(Date.parse(result.expiresAt) > Date.now());
});

test("รหัสผ่านผิดหรือชื่อผู้ใช้ผิด เข้าไม่ได้", async () => {
  for (const [user, pass] of [
    ["gog", "ผิด"],
    ["ไม่ใช่คนนี้", "รหัสผ่านที่ยาวพอสมควร"],
    ["", ""],
  ]) {
    const result = await login(ENV, user, pass);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  }
});

test("ยังไม่ตั้งบัญชีแอดมิน = เข้าไม่ได้เลย ไม่ใช่ปล่อยผ่าน", async () => {
  const result = await login({}, "gog", "อะไรก็ได้");
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(await verifySession({}, "gog|2099-01-01T00:00:00.000Z|xxx"), false);
});

test("ตั๋วที่ถูกแก้ไขหรือเซ็นด้วยความลับอื่น ใช้ไม่ได้", async () => {
  const { token } = await login(ENV, "gog", "รหัสผ่านที่ยาวพอสมควร");

  const [user, expiry, signature] = token.split("|");
  // ยืดอายุตั๋วเองโดยไม่เซ็นใหม่
  const stretched = `${user}|2099-01-01T00:00:00.000Z|${signature}`;
  assert.equal(await verifySession(ENV, stretched), false);

  // เปลี่ยนเป็นชื่อผู้ใช้อื่น
  assert.equal(await verifySession(ENV, `someone|${expiry}|${signature}`), false);

  // ความลับที่ใช้เซ็นคนละตัว
  assert.equal(
    await verifySession({ ...ENV, ADMIN_SESSION_SECRET: "another-secret" }, token),
    false,
  );

  // รูปร่างมั่ว
  assert.equal(await verifySession(ENV, "ไม่ใช่ตั๋ว"), false);
  assert.equal(await verifySession(ENV, null), false);
});

test("ตั๋วหมดอายุแล้วใช้ไม่ได้", async () => {
  const { token } = await login(ENV, "gog", "รหัสผ่านที่ยาวพอสมควร");
  const [user] = token.split("|");
  const expired = `${user}|2020-01-01T00:00:00.000Z|whatever`;
  assert.equal(await verifySession(ENV, expired), false);
});

test("คุกกี้ตั๋วต้องอ่านจาก JavaScript ไม่ได้ และไม่ถูกส่งข้ามเว็บ", () => {
  const cookie = sessionCookie("token-value", 3600);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
});

test("อ่านตั๋วจาก header คุกกี้ได้ถูกตัว", () => {
  const request = new Request("https://example.invalid/", {
    headers: { cookie: `other=1; ${ADMIN_COOKIE}=abc123; last=2` },
  });
  assert.equal(readCookie(request, ADMIN_COOKIE), "abc123");
  assert.equal(readCookie(request, "ไม่มีคุกกี้นี้"), null);
});

test("คลิปปักหมุดที่ผิดรูป ถูกปฏิเสธก่อนเก็บ", () => {
  const valid = {
    src: "/featured/clip.mp4",
    poster: "/featured/clip.jpg",
    title: "หัวข้อ",
    description: "คำอธิบาย",
    durationSec: 46,
    badge: "ปักหมุด",
  };
  assert.equal(parseFeaturedClip(valid).durationSec, 46);
  assert.equal(parseFeaturedClip({ ...valid, badge: "" }).badge, "ปักหมุด");

  const rejects = [
    [{ ...valid, src: "javascript:alert(1)" }, "ลิงก์ที่ไม่ใช่ http"],
    [{ ...valid, poster: "" }, "ภาพปกว่าง"],
    [{ ...valid, title: "   " }, "หัวข้อว่าง"],
    [{ ...valid, durationSec: 0 }, "ความยาวศูนย์"],
    [{ ...valid, durationSec: 99999 }, "ความยาวเกินจริง"],
    ["ไม่ใช่ object", "ข้อมูลที่ไม่ใช่ object"],
  ];
  for (const [payload, why] of rejects) {
    assert.throws(() => parseFeaturedClip(payload), SettingsError, `ต้องปฏิเสธ${why}`);
  }
});
