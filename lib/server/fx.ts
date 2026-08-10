// อัตราแลกเปลี่ยน GBP → THB ของจริง (STEP 43)
// ---------------------------------------------------------------------------
// ค่าธรรมเนียมวีซ่าอังกฤษคิดเป็นปอนด์ ถ้าตรึงเรตไว้ในโค้ดตัวเลขบาทจะเพี้ยนขึ้นเรื่อย ๆ
// ใช้ frankfurter.app (ข้อมูล ECB ฟรี ไม่ต้องใช้คีย์) แล้วให้ Cloudflare แคชไว้ 6 ชั่วโมง
// — เรตอ้างอิงธนาคารกลาง ไม่ใช่เรตซื้อขายหน้าเคาน์เตอร์ ซึ่งพอสำหรับการวางแผน
//
// ถ้าดึงไม่ได้หรือได้ค่าประหลาด ตกกลับไปใช้ FX_FALLBACK เสมอ — หน้าเว็บต้องไม่พัง
// เพราะ API ข้างนอกล่ม และต้องบอกผู้ใช้ตรง ๆ ว่ากำลังใช้ค่าสำรองอยู่ (live: false)

const FX_URL = "https://api.frankfurter.app/latest?from=GBP&to=THB";

/** เรตสำรองเมื่อดึงของจริงไม่ได้ — ต้องตรงกับ GBP_TO_THB ใน services/pricing */
export const FX_FALLBACK = 44;

export type FxRate = {
  rate: number;
  /** วันที่ของเรต (YYYY-MM-DD) — ว่างเมื่อใช้ค่าสำรอง */
  date: string;
  source: string;
  live: boolean;
};

export async function gbpToThb(): Promise<FxRate> {
  try {
    const response = await fetch(FX_URL, {
      cf: { cacheTtl: 21_600, cacheEverything: true },
    } as RequestInit);
    if (!response.ok) throw new Error(`fx_http_${response.status}`);
    const payload = await response.json() as { date?: string; rates?: { THB?: number } };
    const rate = payload.rates?.THB;
    // กันค่าประหลาด: ปอนด์เทียบบาทอยู่แถว 40–46 มาหลายปี ถ้าหลุดช่วง 20–80 คือข้อมูลเสีย
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 20 || rate > 80) {
      throw new Error("fx_out_of_range");
    }
    return {
      rate: Math.round(rate * 100) / 100,
      date: payload.date ?? "",
      source: "frankfurter.app · อ้างอิง ECB",
      live: true,
    };
  } catch {
    return { rate: FX_FALLBACK, date: "", source: "ค่าสำรองในระบบ", live: false };
  }
}
