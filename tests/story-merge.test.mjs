// กฎความปลอดภัยของการรวมข่าว — ไม่ยิงโมเดลและไม่แตะฐานข้อมูลจริง
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isRoundupHeadline } from "../services/news/story-merge-rules.ts";

test("กันข่าวรวมและบล็อกสดออกจากการยืนยันข้ามแหล่ง", () => {
  for (const title of [
    "Transfer news LIVE: Manchester United latest",
    "Manchester United transfer round-up",
    "Premier League rumour mill",
    "Tuesday's transfer gossip",
    "Manchester United 2-1 Arsenal: as it happened",
    "Manchester United news: five things to know",
    "Manchester United latest: all today's updates",
  ]) {
    assert.equal(isRoundupHeadline(title), true, title);
  }

  // ชิ้นบริการรอบนัด — ผูกกับนัดจริงแต่ไม่ได้รายงานเหตุการณ์อะไร
  // ของจริงจากคลัง 12 ส.ค. 2569 ที่เคยถูกจับคู่กับข่าวพรีวิวของ BBC
  for (const title of [
    "Leeds vs Man Utd betting tips, bet builder and predictions: Far from friendly",
    "How to watch Manchester United vs Leeds FOR FREE: TV channel and live stream",
    "Man Utd vs Leeds odds and free bets",
  ]) {
    assert.equal(isRoundupHeadline(title), true, title);
  }

  for (const title of [
    "Manchester United agree deal to sign midfielder",
    "Livewire winger completes Old Trafford medical",
    "Ruben Amorim confirms defender will miss Arsenal match",
    // ยังไม่ถือว่าเป็นชิ้นบริการ — ดูคอมเมนต์ใน story-merge-rules.ts
    "Manchester United XI vs Leeds: Predicted lineup, confirmed team news",
  ]) {
    assert.equal(isRoundupHeadline(title), false, title);
  }
});

test("ใช้คำตัดสินเดิมหลังการซิงก์จากหน้าเว็บ", async () => {
  const api = await readFile(new URL("../lib/server/api.ts", import.meta.url), "utf8");
  const ingestRoute = api.slice(api.indexOf('url.pathname === "/api/ingest"'), api.indexOf("// ── อากาศวันแข่ง"));
  assert.ok(ingestRoute.indexOf("await runIngest(env)") < ingestRoute.indexOf("await applyStoryMerges(env)"));
});

test("รอบอัตโนมัติยุบของเดิมก่อนตัดสินกลุ่มใหม่และยุบผลใหม่อีกครั้ง", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const scheduled = worker.slice(worker.indexOf("runIngest(env)"), worker.indexOf("maybeGenerateMorningDigest(env)"));
  const firstApply = scheduled.indexOf("applyStoryMerges(env)");
  const decide = scheduled.indexOf("decideStoryMerges(env)");
  const secondApply = scheduled.indexOf("applyStoryMerges(env)", firstApply + 1);
  assert.ok(firstApply >= 0 && firstApply < decide && decide < secondApply);
});
