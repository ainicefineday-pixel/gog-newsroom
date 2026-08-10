// ดึงเนื้อข่าวเต็มจากหน้าต้นฉบับ
// ---------------------------------------------------------------------------
// RSS ให้มาแค่พาดหัวกับคำโปรยสั้น ๆ (มักตัดที่ ~200 ตัวอักษร) พอเอาไปให้ Claude
// เรียบเรียงเลยได้สรุปไทยบาง ๆ ตามไปด้วย ตัวนี้จึงไปอ่านหน้าข่าวจริงมาเป็นวัตถุดิบ
//
// เรียกเฉพาะตอนผู้ใช้กด "แปล" เท่านั้น — ครอนไม่แตะ จะได้ไม่ยิงเว็บสำนักข่าว
// ทุก 10 นาทีโดยไม่จำเป็น · เก็บไว้เป็นต้นทางให้เขียนข่าวไทย ไม่ได้เอาไปเผยแพร่ซ้ำ

const MAX_ARTICLE_CHARS = 8_000;
const FETCH_TIMEOUT_MS = 15_000;

const BLOCK_TAGS = ["script", "style", "noscript", "svg", "iframe", "form", "nav", "header", "footer", "aside", "figure"];

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function stripNoise(html: string) {
  let out = html;
  for (const tag of BLOCK_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"), " ");
  }
  return out.replace(/<!--[\s\S]*?-->/g, " ");
}

// ย่อหน้าที่เป็นเนื้อข่าวจริง ๆ มักยาวเกิน 40 ตัวอักษรและมีจุดจบประโยค
// ส่วนพวก "Sign up to our newsletter" / เครดิตภาพ จะสั้นและซ้ำ ๆ จึงคัดออก
const JUNK_PATTERNS = [
  /^(share|advertisement|read more|related|follow us|sign up|subscribe|photo|image|getty|reuters|copyright|all rights reserved)/i,
  /cookie|newsletter|privacy policy|terms of use/i,
];

function paragraphsFrom(html: string) {
  const matches = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  const seen = new Set<string>();
  const paragraphs: string[] = [];
  for (const block of matches) {
    const text = decodeEntities(block.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text.length < 40) continue;
    if (JUNK_PATTERNS.some((pattern) => pattern.test(text))) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    paragraphs.push(text);
  }
  return paragraphs;
}

/**
 * คืนเนื้อข่าวเป็นข้อความล้วน (ย่อหน้าคั่นด้วยบรรทัดว่าง) — คืน "" เมื่อดึงไม่ได้
 * ไม่ throw เพื่อให้ข่าวอื่นในชุดเดียวกันแปลต่อได้แม้เว็บใดเว็บหนึ่งล่ม
 */
export async function fetchArticleText(url: string) {
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "GOG-Newsroom/1.0 (+editorial-research; summarises-and-links-back)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return "";
    const html = stripNoise(await response.text());

    // ถ้าหน้ามี <article> ให้เชื่อบล็อกนั้นก่อน — ตัดเมนู/ข่าวแนะนำออกได้แม่นกว่า
    const article = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
    const preferred = article ? paragraphsFrom(article) : [];
    const paragraphs = preferred.length >= 3 ? preferred : paragraphsFrom(html);
    if (!paragraphs.length) return "";
    return paragraphs.join("\n\n").slice(0, MAX_ARTICLE_CHARS);
  } catch {
    return "";
  }
}

/**
 * ไล่ดึงจากลิงก์ต้นฉบับทีละแหล่งจนกว่าจะได้เนื้อที่ยาวพอ
 * (บางสำนักข่าวมี paywall / render ด้วย JS — ข้ามไปแหล่งถัดไปของข่าวเดียวกัน)
 */
export async function fetchBestArticleText(urls: string[]) {
  for (const url of urls.slice(0, 3)) {
    const text = await fetchArticleText(url);
    if (text.length >= 400) return { text, url };
  }
  return { text: "", url: "" };
}
