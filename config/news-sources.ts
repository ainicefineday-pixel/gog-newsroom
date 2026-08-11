import { X_SOURCE_HANDLES, type XSourceHandle } from "@/config/x-sources";

export type SourceTier = 1 | 2 | 3;

export type NewsSourceDirectoryItem = {
  id: string;
  label: string;
  kind: "rss" | "x";
  homepage: string;
  domain: string;
  tier: SourceTier;
};

export const RSS_NEWS_SOURCES = [
  {
    id: "bbc",
    name: "BBC Sport",
    homepage: "https://www.bbc.com/sport/football",
    domain: "bbc.com",
    feedUrl: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    tier: 1,
  },
  {
    id: "athletic",
    name: "The Athletic",
    homepage: "https://www.nytimes.com/athletic/uk/",
    domain: "nytimes.com",
    feedUrl: "https://www.nytimes.com/athletic/rss/football/",
    tier: 1,
  },
  // The Telegraph ถูกถอดออกเมื่อ 12 ส.ค. 2569
  // ระบบกันบอทของเขาตอบ 403 กับทุก user-agent ที่ไม่อยู่ในรายการอนุญาต
  // (ทดสอบแล้ว: curl ผ่าน แต่ Wget, Chrome, Feedly และชื่อของเราเองโดนบล็อกหมด)
  // และ robots.txt ของเขาห้ามบอท AI ไว้ชัดเจน การปลอม user-agent เพื่อหลบ
  // คือการใช้เนื้อหาโดยเจ้าของไม่ยินยอม จึงเลิกเรียกและใช้ Guardian แทน
  {
    // ฟีดเฉพาะแมนยูของ Sky Sports (feed id 11667) ไม่ใช่ฟีดฟุตบอลรวม
    // ทุกข่าวในฟีดนี้เกี่ยวกับสโมสรอยู่แล้ว จึงผ่านตัวกรองคีย์เวิร์ดเกือบทั้งหมด
    id: "skysports",
    name: "Sky Sports",
    homepage: "https://www.skysports.com/manchester-united",
    domain: "skysports.com",
    feedUrl: "https://www.skysports.com/rss/11667",
    tier: 1,
  },
  {
    // หนังสือพิมพ์ท้องถิ่นแมนเชสเตอร์ ตามข่าวสโมสรใกล้ชิดที่สุด
    // แต่ลงข่าวลือตลาดนักเตะเยอะกว่าเจ้าอื่น จึงจัดเป็น tier 2
    id: "men",
    name: "Manchester Evening News",
    homepage: "https://www.manchestereveningnews.co.uk/all-about/manchester-united-fc",
    domain: "manchestereveningnews.co.uk",
    feedUrl: "https://www.manchestereveningnews.co.uk/all-about/manchester-united-fc/?service=rss",
    tier: 2,
  },
] as const;

const X_TIER_1 = new Set<XSourceHandle>(["david_ornstein", "fabrizioromano", "theathleticfc"]);
const X_TIER_2 = new Set<XSourceHandle>([
  "andymitten",
  "telegraphducker",
  "sistoney67",
  "lauriewhitwell",
  "lukeedwardstele",
  "howardnurse",
  "simonpeach",
]);

function xTier(handle: XSourceHandle): SourceTier {
  if (X_TIER_1.has(handle)) return 1;
  if (X_TIER_2.has(handle)) return 2;
  return 3;
}

/**
 * แหล่งที่ดึงผ่าน API ไม่ใช่ RSS — ต้องมีคีย์ถึงจะทำงาน
 * แยกจาก RSS_NEWS_SOURCES เพราะไม่มี feedUrl ให้ parse
 */
export const API_NEWS_SOURCES = [
  {
    id: "guardian",
    name: "The Guardian",
    homepage: "https://www.theguardian.com/football/manchester-united",
    domain: "theguardian.com",
    tier: 1 as SourceTier,
  },
] as const;

export const NEWS_SOURCE_DIRECTORY: readonly NewsSourceDirectoryItem[] = [
  ...RSS_NEWS_SOURCES.map((source) => ({
    id: source.id,
    label: source.name,
    kind: "rss" as const,
    homepage: source.homepage,
    domain: source.domain,
    tier: source.tier,
  })),
  ...API_NEWS_SOURCES.map((source) => ({
    id: source.id,
    label: source.name,
    kind: "rss" as const,
    homepage: source.homepage,
    domain: source.domain,
    tier: source.tier,
  })),
  ...X_SOURCE_HANDLES.map((handle) => ({
    id: handle,
    label: `@${handle}`,
    kind: "x" as const,
    homepage: `https://x.com/${handle}`,
    domain: "x.com",
    tier: xTier(handle),
  })),
];
