// The Guardian Content API
// ---------------------------------------------------------------------------
// แทนที่ฟีด The Telegraph ที่ถูกระบบกันบอทของเขาบล็อก (403 ทุก user-agent
// ที่ไม่อยู่ในรายการอนุญาต) Guardian เปิด API ให้ใช้อย่างเป็นทางการ
// สมัครคีย์ฟรีที่ https://open-platform.theguardian.com/access/
//
// ใช้เฉพาะพาดหัว คำโปรย และลิงก์กลับต้นฉบับ ไม่ดึงเนื้อข่าวเต็ม
// ตามเงื่อนไขของ Open Platform ที่ให้ใช้ metadata ไม่ใช่คัดลอกบทความ

const ENDPOINT = "https://content.guardianapis.com/search";

export type GuardianItem = {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  author?: string;
  imageUrl?: string;
};

/**
 * ถอด HTML ออกจาก trailText
 * Guardian ส่งคำโปรยมาพร้อมแท็ก <strong> <a> ปนอยู่เสมอ
 * ถ้าไม่ถอดออก หน้าเว็บจะโชว์แท็กดิบ ๆ ให้คนอ่านเห็น
 * และเราไม่ใช้ dangerouslySetInnerHTML กับข้อความจากภายนอกอยู่แล้ว
 */
export function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type GuardianResponse = {
  response?: {
    status?: string;
    results?: Array<{
      id?: string;
      webTitle?: string;
      webUrl?: string;
      webPublicationDate?: string;
      fields?: {
        headline?: string;
        trailText?: string;
        thumbnail?: string;
        byline?: string;
      };
    }>;
  };
};

/**
 * ตรวจโครงสร้างที่ได้กลับมาแบบระวังตัว ไม่เชื่อว่าฟิลด์ไหนมีแน่
 * โปรเจกต์นี้ไม่ได้ใช้ zod ที่อื่นเลย จึงตรวจด้วยมือให้เข้ากับของเดิม
 * รายการที่ขาดฟิลด์จำเป็น (ชื่อเรื่อง ลิงก์ วันที่) ทิ้งไปทีละรายการ
 * ไม่ใช่โยน error ทิ้งทั้งชุด เพราะเสียข่าวที่ใช้ได้ไปด้วยโดยไม่จำเป็น
 */
export function parseGuardian(payload: unknown): GuardianItem[] {
  const results = (payload as GuardianResponse)?.response?.results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((entry) => {
    const title = stripHtml(entry?.fields?.headline || entry?.webTitle || "");
    const url = typeof entry?.webUrl === "string" ? entry.webUrl : "";
    const publishedAt = typeof entry?.webPublicationDate === "string" ? entry.webPublicationDate : "";
    if (!title || !url || !publishedAt) return [];

    return [{
      title: title.slice(0, 240),
      description: stripHtml(entry?.fields?.trailText ?? "").slice(0, 700),
      url,
      publishedAt,
      sourceName: "The Guardian",
      author: entry?.fields?.byline ? stripHtml(entry.fields.byline).slice(0, 120) : undefined,
      imageUrl: typeof entry?.fields?.thumbnail === "string" ? entry.fields.thumbnail : undefined,
    }];
  });
}

/** URL ของคำขอ — แยกออกมาเพื่อทดสอบได้โดยไม่ต้องยิงเน็ตจริง */
export function guardianSearchUrl(apiKey: string) {
  const params = new URLSearchParams({
    q: '"Manchester United"',
    section: "football",
    "order-by": "newest",
    "page-size": "40",
    "show-fields": "headline,trailText,thumbnail,shortUrl,byline",
    "api-key": apiKey,
  });
  return `${ENDPOINT}?${params}`;
}

export async function fetchGuardian(
  apiKey: string,
  fetchText: (url: string) => Promise<string>,
): Promise<GuardianItem[]> {
  const raw = await fetchText(guardianSearchUrl(apiKey));
  return parseGuardian(JSON.parse(raw));
}
