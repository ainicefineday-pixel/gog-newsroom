export const CATEGORIES = [
  "Transfer",
  "Match/Preview",
  "Injury",
  "Quotes/Press",
  "Stats/Analysis",
  "Club/Business",
  "Rumour",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type StorySource = {
  name: string;
  url: string;
  domain: string;
  author?: string;
  handle?: string;
  tier: 1 | 2 | 3;
  publishedAt: string;
};

export type EditorialAngle = {
  hook: string;
  why: string;
};

export type Story = {
  id: string;
  date: string;
  category: Category;
  credibility: number;
  titleEn: string;
  /** คำโปรยจากฟีด RSS — สั้น ใช้เป็นบริบทสำรองเมื่อดึงเนื้อข่าวเต็มไม่ได้ */
  excerptEn: string;
  /** เนื้อข่าวเต็มจากหน้าต้นฉบับ ดึงตอนกดแปล — ใช้เป็นวัตถุดิบให้เขียนข่าวไทย */
  articleEn: string;
  titleTh: string;
  summaryTh: string;
  /** เนื้อข่าวไทยฉบับเต็มที่เรียบเรียงจาก articleEn — ว่างถ้ายังไม่ได้แปล */
  contentTh: string;
  /** true เมื่อคำแปลไทยมาจาก Claude แล้ว (ไม่ใช่ข้อความ placeholder) */
  translated: boolean;
  sources: StorySource[];
  url: string;
  publishedAt: string;
  verified: boolean;
  angles: EditorialAngle[];
  topicTerms: string[];
};

export type Digest = {
  date: string;
  contentTh: string;
  storyCount: number;
  generatedAt: string;
};

