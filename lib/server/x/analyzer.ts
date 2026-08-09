export type AnalyzableXPost = {
  id: number | string;
  text: string;
  language?: string | null;
};

export type XPostAnalysis = {
  postId: number | string;
  summary: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  topics: string[];
  entities: string[];
  model: string;
  analyzedAt: string;
};

// These deterministic placeholders keep the collector AI-ready without
// inventing analysis or requiring another external service at collection time.
export function summarizePosts(posts: AnalyzableXPost[]) {
  return posts.map((post) => ({ postId: post.id, summary: null }));
}

export function classifyTopic(posts: AnalyzableXPost[]) {
  return posts.map((post) => ({ postId: post.id, topics: [] as string[] }));
}

export function sentimentAnalysis(posts: AnalyzableXPost[]) {
  return posts.map((post) => ({ postId: post.id, sentiment: null as XPostAnalysis["sentiment"] }));
}

export function extractEntities(posts: AnalyzableXPost[]) {
  return posts.map((post) => ({ postId: post.id, entities: [] as string[] }));
}
