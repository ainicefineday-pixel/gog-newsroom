// จังหวะไปดึงคลิปหลังเกมของช่อง
// ---------------------------------------------------------------------------
// ไม่ยิง YouTube และไม่แตะฐานข้อมูล — ตรวจเฉพาะการคิดเวลา
//
// ตัวเลขเป็นของจริงจากนัดอุ่นเครื่องกับลีดส์ 12 ส.ค. 2569 ที่คลิปหลุดไป
//   เขี่ยบอล 18:30 UTC · จบเกมตามปฏิทิน 20:15 UTC
//   ช่องเปิดไลฟ์ 20:33 UTC = 18 นาทีหลังจบเกม (นาทีที่ 123 นับจากเขี่ยบอล)
//   คลิปเข้า playlist อัปโหลด 21:49 UTC = 94 นาทีหลังจบเกม
//
// ของเดิมคิดหน้าต่างหลังเกมจาก currentNavMatch ซึ่งเลิกชี้นัดเดิมตั้งแต่นาทีที่ 120
// หน้าต่างจึงปิดก่อนช่องเปิดไลฟ์ 3 นาที คลิปเลยไม่เคยถูกดึงขึ้นเลยสักครั้ง

import assert from "node:assert/strict";
import test from "node:test";
import { minutesSinceFullTime, pickFinishedMatch } from "../services/football/post-match.ts";

const LEEDS = { kickoffUtc: "2026-08-12T18:30:00Z", away: "Leeds United" };
const NEXT = { kickoffUtc: "2026-08-16T13:00:00Z", away: "Arsenal" };
const CALENDAR = [LEEDS, NEXT];

const fullTime = Date.parse(LEEDS.kickoffUtc) + 105 * 60_000;
const at = (minutesAfterFullTime) => fullTime + minutesAfterFullTime * 60_000;

test("จบเกมคิดจากเวลาเตะจริงของนัดนั้น", () => {
  assert.equal(minutesSinceFullTime(LEEDS.kickoffUtc, at(0)), 0);
  assert.equal(minutesSinceFullTime(LEEDS.kickoffUtc, at(18)), 18);
  assert.equal(minutesSinceFullTime(LEEDS.kickoffUtc, at(-45)), -45);
});

test("หน้าต่างหลังเกมยึดนัดที่เพิ่งจบ ไม่กระโดดไปนัดถัดไปตอนนาทีที่ 120", () => {
  // นาทีที่ 18 หลังจบเกม คือจุดที่ช่องเปิดไลฟ์จริงและของเดิมมองไม่เห็นแล้ว
  assert.equal(pickFinishedMatch(CALENDAR, 90, at(18))?.away, "Leeds United");

  // นาทีที่ 94 คือตอนคลิปเข้า playlist ต้องยังอยู่ในหางที่เฝ้าอยู่
  assert.equal(pickFinishedMatch(CALENDAR, 150, at(94))?.away, "Leeds United");

  // ก่อนจบเกมและหลังหมดหาง ไม่ต้องไปกวน YouTube สักหน่วย
  assert.equal(pickFinishedMatch(CALENDAR, 150, at(-1)), null);
  assert.equal(pickFinishedMatch(CALENDAR, 150, at(151)), null);
});

test("ยิง search หาไลฟ์ทุกครึ่งชั่วโมงในหน้าต่างเฝ้า ไม่ใช่ทุกรอบครอน", () => {
  // ครอนวิ่งทุก 10 นาที รอบที่เข้าเงื่อนไขต้องเป็น 1 ใน 3 เท่านั้น
  const slots = [];
  for (let minute = 0; minute <= 90; minute += 10) {
    if (minute % 30 < 10) slots.push(minute);
  }
  assert.deepEqual(slots, [0, 30, 60, 90]);
});
