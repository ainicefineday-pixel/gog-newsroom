// ตัวเลือกผู้ให้บริการและลำดับสำรอง (STEP 7, 83)
// ---------------------------------------------------------------------------
// ลำดับที่ใช้:
//   รายละเอียดแมตช์  API-Football → football-data.org (เท่าที่รองรับ) → แคช GOG
//   ปฏิทินโปรแกรม    football-data.org หรือ API-Football → แคช GOG
//   เมทาดาทา         API-Football → TheSportsDB → ข้อมูลที่ GOG ดูแลเอง
//
// กติกาสำคัญ: ห้ามเอาค่าจากคนละเจ้ามารวมกันเองอัตโนมัติ (STEP 7)
// ถ้าเจ้าแรกตอบได้ก็จบที่เจ้านั้น ไม่ใช่ไปหยิบบางช่องจากอีกเจ้ามาเติม
// เพราะนิยามของแต่ละเจ้าไม่ตรงกัน เอามาผสมแล้วตัวเลขจะเพี้ยนแบบหาต้นตอไม่เจอ

import { createApiFootballProvider } from "@/services/football/providers/apiFootball";
import { createDemoProvider } from "@/services/football/providers/demo";
import { createFootballDataProvider } from "@/services/football/providers/footballData";
import type { FootballProvider, ProviderCapabilities, ProviderFetchResult } from "@/services/football/providers/types";

export type ProviderKeys = {
  apiFootballKey?: string;
  footballDataKey?: string;
};

export type ProviderSet = {
  all: FootballProvider[];
  /** true = ไม่มีคีย์จริงสักเจ้า ทั้งระบบกำลังวิ่งบนข้อมูลตัวอย่าง */
  demoMode: boolean;
};

export function createProviders(keys: ProviderKeys): ProviderSet {
  const apiFootball = createApiFootballProvider(keys.apiFootballKey);
  const footballData = createFootballDataProvider(keys.footballDataKey);
  const configured = [apiFootball, footballData].filter((provider) => provider.isConfigured());
  if (configured.length === 0) {
    return { all: [createDemoProvider()], demoMode: true };
  }
  return { all: configured, demoMode: false };
}

export type AttemptLog = {
  provider: string;
  ok: boolean;
  error?: string;
};

/**
 * ไล่ถามผู้ให้บริการตามลำดับจนกว่าจะมีเจ้าที่ตอบได้
 * ข้ามเจ้าที่ประกาศว่าไม่รองรับความสามารถนี้ตั้งแต่ต้น ไม่ต้องเสียโควตายิงไปลุ้น
 * ทุกเจ้าล้มหมดคืน null พร้อม log ให้ผู้เรียกตัดสินใจว่าจะใช้แคชเก่าหรือขึ้นสถานะไม่มีข้อมูล
 */
export async function tryProviders<T>(
  providers: FootballProvider[],
  capability: keyof ProviderCapabilities,
  run: (provider: FootballProvider) => Promise<ProviderFetchResult<T>> | undefined,
): Promise<{ result: ProviderFetchResult<T> | null; attempts: AttemptLog[] }> {
  const attempts: AttemptLog[] = [];
  for (const provider of providers) {
    if (!provider.capabilities[capability]) continue;
    try {
      const call = run(provider);
      if (!call) continue;
      const result = await call;
      attempts.push({ provider: provider.id, ok: true });
      return { result, attempts };
    } catch (error) {
      attempts.push({
        provider: provider.id,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }
  return { result: null, attempts };
}
