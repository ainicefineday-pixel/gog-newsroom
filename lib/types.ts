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
  titleTh: string;
  summaryTh: string;
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

