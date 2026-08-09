"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category, type Digest, type Story } from "@/lib/types";

type LastSync = {
  finished_at: string;
  fetched: number;
  matched: number;
  stored: number;
  status: string;
} | null;

const CATEGORY_META: Record<Category, { icon: string; label: string; className: string }> = {
  Transfer: { icon: "↔", label: "ตลาดนักเตะ", className: "transfer" },
  "Match/Preview": { icon: "●", label: "แมตช์ / พรีวิว", className: "match" },
  Injury: { icon: "+", label: "อาการบาดเจ็บ", className: "injury" },
  "Quotes/Press": { icon: "“", label: "คำพูด / แถลง", className: "quotes" },
  "Stats/Analysis": { icon: "≡", label: "สถิติ / วิเคราะห์", className: "analysis" },
  "Club/Business": { icon: "◆", label: "สโมสร / ธุรกิจ", className: "club" },
  Rumour: { icon: "?", label: "ข่าวลือ", className: "rumour" },
};

function relativeTime(iso: string, now: Date) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "เมื่อสักครู่";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

function formatThaiDate(date: string) {
  const parsed = new Date(`${date}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function credibilityClass(score: number) {
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  return "low";
}

function todayBangkok() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function TopStoryCard({ story, rank, active, onSelect }: { story: Story; rank: number; active: boolean; onSelect: () => void }) {
  const meta = CATEGORY_META[story.category];
  return (
    <button className={`top-story ${active ? "active" : ""}`} onClick={onSelect} type="button">
      <span className="top-rank">0{rank}</span>
      <span className={`category-dot ${meta.className}`} aria-hidden="true" />
      <span className="top-story-copy">
        <span className="top-story-kicker">{meta.label}</span>
        <strong>{story.titleTh}</strong>
        <span className="top-story-source">{story.sources[0]?.name ?? "ต้นฉบับ"} · {story.credibility}/100</span>
      </span>
      <span className="top-arrow" aria-hidden="true">↗</span>
    </button>
  );
}

function StoryCard({ story, now }: { story: Story; now: Date }) {
  const meta = CATEGORY_META[story.category];
  return (
    <article className="story-card">
      <div className="story-score-column">
        <div className={`score-ring ${credibilityClass(story.credibility)}`} style={{ "--score": story.credibility } as React.CSSProperties}>
          <strong>{story.credibility}</strong>
          <span>SCORE</span>
        </div>
        <span className="tier-label">TIER {story.credibility >= 90 ? "1" : story.credibility >= 70 ? "2" : "3"}</span>
      </div>

      <div className="story-content">
        <div className="story-meta-row">
          <span className={`category-badge ${meta.className}`}><b>{meta.icon}</b>{meta.label}</span>
          {story.verified ? (
            <span className="verified-badge"><b>✓</b> ยืนยันข้ามแหล่ง</span>
          ) : (
            <span className="unverified-badge">ยังไม่ยืนยัน</span>
          )}
          <time dateTime={story.publishedAt}>{relativeTime(story.publishedAt, now)}</time>
        </div>

        <h2>{story.titleTh}</h2>
        <p className="summary-th">{story.summaryTh}</p>
        <p className="headline-en"><span>EN</span>{story.titleEn}</p>

        <div className="story-footer">
          <div className="source-list" aria-label="แหล่งข่าวต้นฉบับ">
            {story.sources.map((source) => (
              <a key={source.url} className="source-chip" href={source.url} target="_blank" rel="noreferrer">
              {/* Dynamic third-party favicons are deliberately not sent through the image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=32`} alt="" width="13" height="13" />
                <span>{source.name}</span>
                <small>T{source.tier}</small>
                <b aria-hidden="true">↗</b>
              </a>
            ))}
          </div>
          <span className="source-count">{story.sources.length} แหล่งข่าว</span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">G</div>
      <div>
        <span className="eyebrow">LIVE INGESTION</span>
        <h2>{syncing ? "กำลังตรวจข่าวจากแหล่งต้นฉบับ…" : "ยังไม่มีข่าวที่ผ่านเกณฑ์"}</h2>
        <p>ระบบจะแสดงเฉพาะรายการที่ตรงกับแมนเชสเตอร์ ยูไนเต็ด พร้อมลิงก์ต้นฉบับและสถานะการยืนยัน</p>
      </div>
      <button className="primary-button" type="button" onClick={onSync} disabled={syncing}>
        {syncing ? "กำลังซิงก์" : "ซิงก์ข่าวตอนนี้"}
      </button>
    </div>
  );
}

export function Newsroom() {
  const [stories, setStories] = useState<Story[]>([]);
  const [lastSync, setLastSync] = useState<LastSync>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [minCredibility, setMinCredibility] = useState(40);
  const [source, setSource] = useState("All");
  const [selectedTopId, setSelectedTopId] = useState("");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const initialSyncAttempted = useRef(false);
  const syncInFlight = useRef(false);

  const loadStories = useCallback(async () => {
    const response = await fetch("/api/stories?days=14", { cache: "no-store" });
    if (!response.ok) throw new Error("ไม่สามารถโหลดคลังข่าวได้");
    const payload = await response.json() as { stories: Story[]; lastSync: LastSync };
    setStories(payload.stories);
    setLastSync(payload.lastSync);
    return payload.stories;
  }, []);

  const sync = useCallback(async (automatic = false) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/ingest", { method: "POST" });
      if (!response.ok) throw new Error("แหล่งข่าวยังไม่พร้อมให้ซิงก์");
      await loadStories();
    } catch (syncError) {
      if (!automatic) setError(syncError instanceof Error ? syncError.message : "ซิงก์ไม่สำเร็จ");
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, [loadStories]);

  useEffect(() => {
    window.queueMicrotask(() => setNow(new Date()));
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      loadStories()
        .then((loaded) => {
          if (active && loaded.length === 0 && !initialSyncAttempted.current) {
            initialSyncAttempted.current = true;
            void sync(true);
          }
        })
        .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ"))
        .finally(() => active && setLoading(false));
    });
    return () => { active = false; };
  }, [loadStories, sync]);

  const sourceOptions = useMemo(() => {
    return [...new Set(stories.flatMap((story) => story.sources.map((item) => item.name)))].sort();
  }, [stories]);

  const filteredStories = useMemo(() => stories.filter((story) => {
    return (category === "All" || story.category === category)
      && story.credibility >= minCredibility
      && (source === "All" || story.sources.some((item) => item.name === source));
  }), [stories, category, minCredibility, source]);

  const groupedStories = useMemo(() => {
    const groups = new Map<string, Story[]>();
    for (const story of filteredStories) groups.set(story.date, [...(groups.get(story.date) ?? []), story]);
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [filteredStories]);

  const topStories = useMemo(() => {
    const newestDate = stories[0]?.date;
    const pool = stories.filter((story) => story.date === newestDate);
    return pool
      .map((story) => ({ story, rank: story.credibility / (1 + Math.max(0, (now?.getTime() ?? 0) - new Date(story.publishedAt).getTime()) / 86_400_000) }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 3)
      .map((item) => item.story);
  }, [stories, now]);

  const selectedTop = topStories.find((story) => story.id === selectedTopId) ?? topStories[0];

  const trendTerms = useMemo(() => {
    const cutoff = (now?.getTime() ?? 0) - 7 * 86_400_000;
    const counts = new Map<string, number>();
    for (const story of stories) {
      if (new Date(story.publishedAt).getTime() < cutoff) continue;
      for (const term of story.topicTerms) counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [stories, now]);

  const lifecycleStory = useMemo(() => stories
    .filter((story) => story.category === "Transfer" || story.category === "Rumour")
    .sort((a, b) => b.sources.length - a.sources.length || b.credibility - a.credibility)[0], [stories]);

  const loadDigest = async () => {
    setDigestLoading(true);
    try {
      const response = await fetch("/api/digest", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { digest: Digest };
      setDigest(payload.digest);
    } catch {
      setError("ยังสร้างสรุปข่าวเช้าไม่ได้");
    } finally {
      setDigestLoading(false);
    }
  };

  const copyDigest = async () => {
    if (!digest) return;
    await navigator.clipboard.writeText(digest.contentTh);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const verifiedCount = stories.filter((story) => story.verified).length;

  return (
    <div className="newsroom-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="GOG Newsroom home">
          <span className="brand-mark">G</span>
          <span><b>GOG</b> NEWSROOM<small>MU NEWS INTELLIGENCE</small></span>
        </a>
        <nav aria-label="เมนูหลัก">
          <a className="active" href="#news">ข่าวล่าสุด</a>
          <a href="#angles">มุมทำคอนเทนต์</a>
          <a href="#digest">สรุปรายวัน</a>
          <a href="#trends">เทรนด์</a>
        </nav>
        <div className="header-status">
          <span className="live-pill"><i /> LIVE</span>
          <div className="clock"><b>{now ? formatClock(now) : "--:--:--"}</b><small>เวลาไทย · ICT</small></div>
          <button className="sync-button" type="button" onClick={() => void sync()} disabled={syncing} aria-label="ซิงก์ข่าวล่าสุด">
            <span className={syncing ? "spinning" : ""}>↻</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span /> ข่าวปีศาจแดง • คัดกรองโดยระบบข่าวกรอง</div>
            <h1>รู้จริงก่อนใคร<br /><em>เชื่อเฉพาะที่ยืนยันได้</em></h1>
            <p>รวมทุกความเคลื่อนไหวของแมนเชสเตอร์ ยูไนเต็ด<br />กลั่นจากแหล่งข่าวต้นฉบับ เพื่อแฟนผีแดงชาวไทย</p>
            <div className="hero-stats">
              <div><strong>{stories.length || "—"}</strong><span>ข่าวในระบบ</span></div>
              <div><strong>{verifiedCount || "—"}</strong><span>ยืนยันแล้ว</span></div>
              <div><strong>{sourceOptions.length || "—"}</strong><span>แหล่งข่าว</span></div>
            </div>
          </div>
          <div className="hero-insignia" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-monogram">GOG<span>MU / TH</span></div>
          </div>
          <div className="hero-update">
            <span>LAST SYNCED</span>
            <b>{lastSync && now ? relativeTime(lastSync.finished_at, now) : syncing ? "กำลังซิงก์…" : lastSync ? "ซิงก์แล้ว" : "ยังไม่เคยซิงก์"}</b>
            <small>{lastSync ? `${lastSync.matched} รายการตรงเกณฑ์ · ${lastSync.stored} คลัสเตอร์` : "RSS พร้อมทำงานโดยไม่ต้องใช้ API key"}</small>
          </div>
        </section>

        <section className="top-section" aria-labelledby="top-heading">
          <div className="section-heading">
            <div><span className="eyebrow">DAILY PRIORITY</span><h2 id="top-heading">เรื่องเด่นวันนี้</h2></div>
            <p>จัดอันดับจากความน่าเชื่อถือ <b>×</b> ความสดใหม่</p>
          </div>
          {topStories.length ? (
            <div className="top-grid">
              {topStories.map((story, index) => <TopStoryCard key={story.id} story={story} rank={index + 1} active={story.id === selectedTop?.id} onSelect={() => setSelectedTopId(story.id)} />)}
            </div>
          ) : (
            <div className="top-placeholder">เรื่องที่ผ่านเกณฑ์สูงสุดจะปรากฏที่นี่หลังการซิงก์</div>
          )}
        </section>

        <section className="filter-bar" aria-label="ตัวกรองข่าว">
          <div className="category-filters">
            <button type="button" className={category === "All" ? "active" : ""} onClick={() => setCategory("All")}><span>☰</span> ทั้งหมด</button>
            {CATEGORIES.map((item) => (
              <button type="button" key={item} className={`${category === item ? "active" : ""} ${CATEGORY_META[item].className}`} onClick={() => setCategory(item)}>
                <span>{CATEGORY_META[item].icon}</span>{CATEGORY_META[item].label}
              </button>
            ))}
          </div>
          <div className="filter-controls">
            <label className="range-control">
              <span>ความน่าเชื่อถือ <b>{minCredibility}+</b></span>
              <input type="range" min="40" max="100" step="5" value={minCredibility} onChange={(event) => setMinCredibility(Number(event.target.value))} />
            </label>
            <label className="select-control">
              <span>แหล่งข่าว</span>
              <select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="All">ทุกแหล่ง</option>
                {sourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
        </section>

        {error && <div className="error-banner" role="status"><span>!</span>{error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <div className="content-layout">
          <section className="feed" id="news" aria-labelledby="latest-heading">
            <div className="feed-title-row">
              <div><span className="eyebrow">VERIFIED NEWS FEED</span><h2 id="latest-heading">ข่าวล่าสุด</h2></div>
              <span>{filteredStories.length} เรื่อง</span>
            </div>
            {loading && !stories.length ? (
              <div className="loading-stack" aria-label="กำลังโหลดข่าว"><i /><i /><i /></div>
            ) : groupedStories.length ? groupedStories.map(([date, items]) => (
              <div className="date-group" key={date}>
                <div className="date-divider">
                  <span>{date === todayBangkok() ? "วันนี้" : "ข่าวประจำวัน"}</span>
                  <strong>{formatThaiDate(date)}</strong>
                  <i />
                  <small>{items.length} ข่าว</small>
                </div>
                <div className="story-list">
                  {items.map((story) => <StoryCard key={story.id} story={story} now={now ?? new Date(0)} />)}
                </div>
              </div>
            )) : <EmptyState syncing={syncing} onSync={() => void sync()} />}
          </section>

          <aside className="intelligence-column">
            <section className="intel-card angles-card" id="angles">
              <div className="intel-heading">
                <span className="intel-icon">A</span>
                <div><span className="eyebrow">EDITORIAL AI</span><h2>มุมทำคอนเทนต์</h2></div>
                <span className="ai-badge">CLAUDE</span>
              </div>
              {selectedTop ? (
                <>
                  <p className="selected-story-label">จากเรื่องเด่น: <b>{selectedTop.titleTh}</b></p>
                  <div className="angle-list">
                    {selectedTop.angles.map((angle, index) => (
                      <article key={`${angle.hook}-${index}`}>
                        <span>0{index + 1}</span>
                        <div><h3>{angle.hook}</h3><p>{angle.why}</p></div>
                      </article>
                    ))}
                  </div>
                </>
              ) : <p className="panel-empty">มุมคอนเทนต์จะสร้างจากข่าวเด่น โดยยึดเฉพาะข้อมูลในต้นฉบับ</p>}
            </section>

            <section className="intel-card digest-card" id="digest">
              <div className="intel-heading">
                <span className="intel-icon">07</span>
                <div><span className="eyebrow">MORNING BRIEF · 07:00 ICT</span><h2>สรุปข่าวเช้า</h2></div>
              </div>
              {digest ? (
                <>
                  <div className="digest-preview">{digest.contentTh}</div>
                  <div className="digest-actions">
                    <button type="button" onClick={() => void copyDigest()}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกข้อความ"}</button>
                    <a href={`/api/digest/export?date=${digest.date}`}>ส่งออก .txt ↓</a>
                  </div>
                </>
              ) : (
                <>
                  <p className="panel-empty">รวบรวมเฉพาะข่าวเมื่อวานที่มีแหล่งข่าวคุณภาพยืนยันอิสระอย่างน้อย 2 แหล่ง</p>
                  <button className="outline-button" type="button" onClick={() => void loadDigest()} disabled={digestLoading}>{digestLoading ? "กำลังสร้าง…" : "เปิดสรุปล่าสุด"}</button>
                </>
              )}
            </section>

            <section className="intel-card trend-card" id="trends">
              <div className="intel-heading">
                <span className="intel-icon">↗</span>
                <div><span className="eyebrow">LAST 7 DAYS</span><h2>ประเด็นกำลังร้อน</h2></div>
              </div>
              {trendTerms.length ? (
                <div className="trend-list">
                  {trendTerms.map(([term, count], index) => (
                    <div className="trend-row" key={term}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><b>{term}</b><i><em style={{ width: `${Math.max(12, (count / trendTerms[0][1]) * 100)}%` }} /></i></div>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="panel-empty">กราฟจะเริ่มแสดงเมื่อมีหัวข้อที่พบซ้ำในคลังข่าว 7 วัน</p>}
            </section>

            <section className="intel-card lifecycle-card">
              <div className="intel-heading">
                <span className="intel-icon">⇢</span>
                <div><span className="eyebrow">RUMOUR LIFECYCLE</span><h2>เส้นทางข่าวซื้อขาย</h2></div>
              </div>
              {lifecycleStory ? (
                <>
                  <h3 className="lifecycle-title">{lifecycleStory.titleTh}</h3>
                  <div className="timeline">
                    {lifecycleStory.sources.map((item) => (
                      <div className={`timeline-item tier-${item.tier}`} key={item.url}>
                        <span />
                        <div>
                          <small>{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(item.publishedAt))}</small>
                          <b>{item.name}</b>
                          <em>Tier {item.tier}{item.tier === 1 ? " · แหล่งหลัก" : item.tier === 2 ? " · นักข่าวเชื่อถือได้" : " · กล่าวถึงครั้งแรก"}</em>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`lifecycle-status ${lifecycleStory.verified ? "confirmed" : "watching"}`}>
                    <span>{lifecycleStory.verified ? "✓" : "•"}</span>
                    <div><b>{lifecycleStory.verified ? "ยืนยันข้ามแหล่งแล้ว" : "กำลังติดตาม"}</b><small>{lifecycleStory.verified ? "มีแหล่ง Tier 1–2 อิสระอย่างน้อย 2 แหล่ง" : "ยังไม่ถึงเกณฑ์ยืนยัน — อย่าเพิ่งสรุปเป็นข้อเท็จจริง"}</small></div>
                  </div>
                </>
              ) : <p className="panel-empty">เมื่อพบข่าวซื้อขาย ระบบจะแสดงพัฒนาการตั้งแต่แหล่งแรกจนถึงการยืนยัน</p>}
            </section>
          </aside>
        </div>
      </main>

      <footer>
        <div className="footer-brand"><span className="brand-mark">G</span><div><b>GOG NEWSROOM</b><small>FACTS FIRST. UNITED ALWAYS.</small></div></div>
        <p>นำเสนอเฉพาะพาดหัวและสรุปสั้นเพื่อการติดตามข่าว · ลิขสิทธิ์บทความเป็นของแหล่งข่าวต้นฉบับ</p>
        <div><span><i /> ระบบออนไลน์</span><a href="#top">กลับด้านบน ↑</a></div>
      </footer>
    </div>
  );
}
