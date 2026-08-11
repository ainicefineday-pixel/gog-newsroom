// ทดสอบตัวแปลงข้อมูลของ The Guardian — ไม่ยิงเน็ตจริง ใช้ payload จำลองล้วน
// ---------------------------------------------------------------------------
// รันด้วย: node --test tests/guardian.test.mjs
// ไฟล์นี้อ่านซอร์ส TypeScript ตรง ๆ ผ่าน type stripping ของ Node 24
// จึงไม่ต้องตั้ง build step เพิ่มสำหรับเทสต์

import assert from "node:assert/strict";
import test from "node:test";
import { parseGuardian, stripHtml, guardianSearchUrl } from "../services/news/guardian.ts";

test("ถอด HTML ออกจากคำโปรยของ Guardian", () => {
  assert.equal(
    stripHtml("<strong>Ruben Amorim</strong> says <a href='#'>United</a> must improve"),
    "Ruben Amorim says United must improve",
  );
  assert.equal(stripHtml("Fee rising to &pound;60m &amp; add-ons"), "Fee rising to &pound;60m & add-ons");
  assert.equal(stripHtml("  เว้นวรรค   เยอะ   "), "เว้นวรรค เยอะ");
});

test("แปลงผลลัพธ์ Guardian เป็นรูปแบบภายใน", () => {
  const items = parseGuardian({
    response: {
      status: "ok",
      results: [{
        webTitle: "Fallback title",
        webUrl: "https://www.theguardian.com/football/2026/aug/12/man-utd",
        webPublicationDate: "2026-08-12T09:00:00Z",
        fields: {
          headline: "Manchester United agree deal",
          trailText: "<p>United have <strong>agreed</strong> terms</p>",
          thumbnail: "https://media.guim.co.uk/thumb.jpg",
          byline: "Jamie Jackson",
        },
      }],
    },
  });

  assert.equal(items.length, 1);
  // headline ต้องชนะ webTitle เมื่อมีทั้งคู่
  assert.equal(items[0].title, "Manchester United agree deal");
  assert.equal(items[0].description, "United have agreed terms");
  assert.equal(items[0].author, "Jamie Jackson");
  assert.equal(items[0].sourceName, "The Guardian");
  assert.equal(items[0].publishedAt, "2026-08-12T09:00:00Z");
});

test("ใช้ webTitle เมื่อไม่มี headline", () => {
  const items = parseGuardian({
    response: { results: [{
      webTitle: "Only webTitle here",
      webUrl: "https://www.theguardian.com/football/x",
      webPublicationDate: "2026-08-12T09:00:00Z",
    }] },
  });
  assert.equal(items[0].title, "Only webTitle here");
  assert.equal(items[0].description, "");
});

test("ทิ้งเฉพาะรายการที่ขาดฟิลด์จำเป็น ไม่ทิ้งทั้งชุด", () => {
  const items = parseGuardian({
    response: { results: [
      { webTitle: "ไม่มีลิงก์", webPublicationDate: "2026-08-12T09:00:00Z" },
      { webUrl: "https://www.theguardian.com/football/y", webPublicationDate: "2026-08-12T09:00:00Z" },
      { webTitle: "ครบทุกอย่าง", webUrl: "https://www.theguardian.com/football/z", webPublicationDate: "2026-08-12T10:00:00Z" },
    ] },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "ครบทุกอย่าง");
});

test("payload ที่ผิดรูปคืนลิสต์ว่าง ไม่โยน error", () => {
  assert.deepEqual(parseGuardian(null), []);
  assert.deepEqual(parseGuardian({}), []);
  assert.deepEqual(parseGuardian({ response: {} }), []);
  assert.deepEqual(parseGuardian({ response: { results: "ไม่ใช่อาเรย์" } }), []);
  assert.deepEqual(parseGuardian('{"response":{}}'), []);
});

test("ประกอบ URL ค้นหาด้วย URLSearchParams และไม่ทำคีย์หลุดในพารามิเตอร์อื่น", () => {
  const url = new URL(guardianSearchUrl("KEY-123"));
  assert.equal(url.origin + url.pathname, "https://content.guardianapis.com/search");
  assert.equal(url.searchParams.get("q"), '"Manchester United"');
  assert.equal(url.searchParams.get("section"), "football");
  assert.equal(url.searchParams.get("order-by"), "newest");
  assert.equal(url.searchParams.get("page-size"), "40");
  assert.equal(url.searchParams.get("api-key"), "KEY-123");
  // เครื่องหมายคำพูดต้องถูก encode ไม่ใช่หลุดออกมาดิบ ๆ
  assert.ok(url.search.includes("q=%22Manchester+United%22"));
});
