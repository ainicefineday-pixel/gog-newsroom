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
  {
    // ฟีดเฉพาะแมนยูของ BBC — รายการน้อย (ราว 4 ชิ้น) แต่เกี่ยวกับสโมสรทุกชิ้น
    // ต่างจากฟีดฟุตบอลรวมข้างบนที่มี 76 ชิ้นแต่เกี่ยวกับแมนยูแค่ 2-4 ชิ้น
    // เก็บทั้งสองฟีดไว้ ตัวจับกลุ่มข่าวซ้ำจัดการเรื่องซ้ำให้เอง
    id: "bbcmutd",
    name: "BBC Sport · แมนยู",
    homepage: "https://www.bbc.com/sport/football/teams/manchester-united",
    domain: "bbc.com",
    feedUrl: "https://feeds.bbci.co.uk/sport/football/teams/manchester-united/rss.xml",
    tier: 1,
  },
  {
    // ทดสอบ 12 ส.ค. 2569: 25 รายการ เจอคำว่าแมนยู 110 ครั้ง
    // เป็นแท็บลอยด์ ข่าวลือเยอะ จึงตกไปเป็น tier 3 ตามค่าเริ่มต้นของตัวให้คะแนน
    // ซึ่งถูกต้องแล้ว ไม่ต้องเพิ่มกฎให้
    id: "mirror",
    name: "Mirror Football",
    homepage: "https://www.mirror.co.uk/all-about/manchester-united-fc",
    domain: "mirror.co.uk",
    feedUrl: "https://www.mirror.co.uk/all-about/manchester-united-fc/?service=rss",
    tier: 3,
  },
  {
    // ทดสอบ 12 ส.ค. 2569: 100 รายการ เจอคำว่าแมนยู 71 ครั้ง
    id: "talksport",
    name: "talkSPORT",
    homepage: "https://talksport.com/football/",
    domain: "talksport.com",
    feedUrl: "https://talksport.com/football/feed/",
    tier: 3,
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
  {
    // เพิ่มเพื่อแก้คอขวดการยืนยันข้ามสำนักโดยตรง ไม่ใช่เพราะอยากได้ข่าวเยอะขึ้น
    // ตรวจคลัง 12 ส.ค. 2569: ข่าวที่มีหลายโดเมน 11 ชิ้น ผ่านเกณฑ์แค่ 3
    // อีก 8 ชิ้นตกด้วยรูปแบบเดียวกันหมดคือแหล่ง tier<=2 หนึ่งเจ้าคู่กับแท็บลอยด์
    // เพราะทั้งระบบมีแหล่ง tier<=2 แค่ 5 โดเมน แต่ Mirror กับ talkSPORT
    // ผลิตข่าวรวมกัน 58 จาก 135 ชิ้น ตัวยืนยันจึงมักเป็นแท็บลอยด์
    //
    // ทดสอบฟีดจริง 12 ส.ค. 2569: 20 รายการ พาดหัวที่เอ่ยแมนยู 6 ชิ้น
    // ในนั้นเป็นข่าวเดี่ยวที่ใช้ยืนยันได้จริง 4 ชิ้น (อีก 2 เป็นบล็อกสดกับ how-to-watch)
    // หนึ่งในนั้นคือเรื่อง Lewis-Skelly ซึ่งเป็นเรื่องที่ระบบพยายามยืนยันอยู่พอดี
    //
    // tier 2 โปรไฟล์เดียวกับ M.E.N. — มีโต๊ะข่าวจริงแต่ลงข่าวลือเยอะ
    // ไม่ได้ทดสอบฟีดเฉพาะแมนยูของเขาเพราะดึงมาแล้วได้ 0 รายการ จึงใช้ฟีดฟุตบอลรวม
    id: "standard",
    name: "Evening Standard",
    homepage: "https://www.standard.co.uk/sport/football",
    domain: "standard.co.uk",
    feedUrl: "https://www.standard.co.uk/sport/football/rss",
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

/**
 * tier ที่ไดเรกทอรีนี้ "ประกาศไว้" สำหรับลิงก์หนึ่ง ๆ — null คือไม่รู้จักแหล่งนี้
 *
 * มีไว้ให้ท่อข่าวเรียกใช้แทนการพิมพ์รายชื่อแหล่งซ้ำไว้ในไฟล์ตัวเอง
 * เดิม pipeline เดา tier จากการจับสตริงชื่อแหล่ง ซึ่งเป็นรายชื่อคนละชุดกับที่นี่
 * สองชุดนั้นเลื่อนออกจากกันมาแล้วจริง ๆ — Sky Sports กับ M.E.N. เคยถูกเก็บเป็น
 * tier 3 ทั้งที่ประกาศไว้ 1 กับ 2 และข่าวที่เก็บไปแล้วก็ค้าง tier ผิดถาวร
 * เพราะ tier ถูกเขียนลงคลังตอน ingest ไม่ได้คิดใหม่ตอนอ่าน
 *
 * จับคู่ด้วยโดเมนจริงของลิงก์ ไม่ใช่ชื่อที่ฟีดประกาศมา เพราะชื่อเปลี่ยนได้
 * ส่วน x.com ต้องดูราย handle เพราะโดเมนเดียวกันแต่คนละบัญชีคนละความน่าเชื่อถือ
 */
export function declaredTierFor(url: string, handle?: string): SourceTier | null {
  let domain: string;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  if (domain === "x.com" || domain === "twitter.com") {
    if (!handle) return null;
    const account = NEWS_SOURCE_DIRECTORY.find((source) =>
      source.kind === "x" && source.id.toLowerCase() === handle.toLowerCase());
    return account?.tier ?? null;
  }

  const entry = NEWS_SOURCE_DIRECTORY.find((source) =>
    source.kind === "rss" && (domain === source.domain || domain.endsWith(`.${source.domain}`)));
  return entry?.tier ?? null;
}
