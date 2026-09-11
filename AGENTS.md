# GOG NEWSROOM — อ่านก่อนเริ่มงาน (สำหรับ Codex / Claude / คนใหม่)

ห้องข่าว Man United ภาษาไทย บน Cloudflare Workers + D1 (สแตก vinext · Drizzle) · รายละเอียดฟีเจอร์และการตั้งค่า provider อยู่ใน `README.md` และ `docs/`

## โครง

- remote `https://github.com/ainicefineday-pixel/gog-newsroom` (public) · production `https://gog-newsroom.geniusontheground.workers.dev`
- Cloudflare account `geniusontheground` · D1 `gog-newsroom-db` (APAC) ผูก binding `env.DB` · cron `*/10 * * * *` ยิง scheduled handler sync ข่าว
- clone ที่ใช้งาน: `C:\Users\User\gog-newsroom` · สำเนาเก่าที่ `C:\Users\User\Documents\Codex\2026-08-09\project-gog-newsroom-manchester-united-news` มี `.cloudflare-token` และ `.dev.vars` (gitignored ทั้งคู่) — **จะ deploy จาก clone นี้ต้องคัดลอกสองไฟล์นั้นมาก่อน** (หรือสร้าง token ใหม่ที่ dash.cloudflare.com/profile/api-tokens เทมเพลต "Edit Cloudflare Workers" + Account → D1 → Edit)

## ⚠️ กติกา

1. **deploy = ขึ้น production ทันที** — commit ไว้ในเครื่อง แล้วรอเจ้าของสั่ง deploy/push
2. ห้ามพิมพ์เนื้อหา `.cloudflare-token` · `.dev.vars` · คีย์ใด ๆ ออกมาในคำตอบ
3. **ห้าม `wrangler login`** — OAuth callback รอแค่ ~2 นาที ล้มมาแล้ว 3 รอบติด · `deploy.ps1` อ่าน `.cloudflare-token` เอง
4. แอปไม่เก็บบทความเต็ม — เก็บเฉพาะพาดหัว สรุปสั้น เมตาการยืนยัน และลิงก์ต้นฉบับ (README) อย่าเพิ่มการเก็บเนื้อหาเต็ม
5. ไม่มีข้อมูล = บอกว่าไม่มี ห้ามแต่ง

## รัน / ตรวจ / deploy

```bash
npm run dev            # โหมด RSS-only ไม่ต้องมีคีย์ · คัดลอก .env.example → .env.local ใส่เฉพาะคีย์ที่มี
npm run lint
npm test               # = npm run build + node --test tests/*.test.mjs
npm run build
.\deploy.ps1           # PowerShell · สร้าง D1 ถ้ายังไม่มี → build → deploy (อ่าน .cloudflare-token เอง)
npx wrangler secret put <KEY> --config dist/server/wrangler.json   # ใส่ secret บน Workers (เช่น YOUTUBE_API_KEY · NEWSAPI_KEY)
```

## กับดักที่เคยเจอ

- `database_id` ใน `vite.config.ts` เคยเป็น placeholder `00000000-…` (ตอนสร้างครั้งแรกตั้งใจ deploy ที่อื่น) — ต้องอ่านจาก env `CF_D1_DATABASE_ID` ไม่งั้น deploy ที่ Cloudflare ไม่ได้ และ build เดิมไม่มี cron trigger
- ยังไม่ได้ผูกโดเมนของตัวเอง (ใช้ workers.dev) · `YOUTUBE_API_KEY` / `NEWSAPI_KEY` อาจยังไม่ได้ใส่ — ตรวจก่อนสรุปว่าฟีดพัง
- เส้นเชื่อมกับ GROUND CALL: `GROUND_CALL_INGEST_KEY` ใน `.dev.vars` ต้องเท่ากับ `GOG_NEWS_API_KEY` ฝั่ง `C:\Users\User\ground-call` ไม่งั้น `/api/ground-call/clips` ตอบ 503
- ช่อง YouTube จริงของโปรเจกต์คือ `@footballgeniusag` (channel ID `UC82BBS4wEQ5GvqIcbEihRlw`) ไม่ใช่ `@footballgenius` — ปักด้วย channel ID เสมอ

## ที่เกี่ยวข้อง (คนละรีโป)

- `C:\Users\User\ground-call` — สตูดิโอคลิป อั้ม×โย่ (ส่งคลิปเข้าหน้าข่าวนี้) มี `AGENTS.md` ของตัวเอง
- `C:\Users\User\social-dashboard` — GOG ANALYTIC (TikTok/IG @yo_theerat · YouTube) static ล้วน `node server.mjs` :4321
