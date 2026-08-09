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
    id: "telegraph",
    name: "The Telegraph",
    homepage: "https://www.telegraph.co.uk/football/",
    domain: "telegraph.co.uk",
    feedUrl: "https://www.telegraph.co.uk/football/rss.xml",
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

export const NEWS_SOURCE_DIRECTORY: readonly NewsSourceDirectoryItem[] = [
  ...RSS_NEWS_SOURCES.map((source) => ({
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
