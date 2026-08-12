"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, Check, ChevronDown, CirclePlay, Copy, FileText, Flag, Languages, MapPinned, Newspaper, Plane, RefreshCw, ShieldCheck, Swords, UsersRound } from "lucide-react";
import { NEWS_SOURCE_DIRECTORY, type NewsSourceDirectoryItem } from "@/config/news-sources";
import { CATEGORIES, type Category, type Digest, type Story } from "@/lib/types";
import { AnthemPlayer } from "@/app/anthem-player";
import { MatchCenter } from "@/app/match-center";
import { AuroraText } from "@/app/aurora-text";
import { NewsFlow } from "@/app/news-flow";
import { MatchStrip } from "@/app/match-strip";
import { AnimatedCircularProgressBar } from "@/app/circular-progress";
import { GogHubBento } from "@/app/bento";

/** ค้างพาดหัวไว้กี่มิลลิวินาทีก่อนสลับ — ความยาวการเฟดคุมด้วย CSS ฝั่ง .hero-rotator-slide */
const HERO_HOLD_MS = 6_500;
import { FixturesPanel, GogTeamPanel } from "@/app/gog-hub";
import { StadiumMapPanel } from "@/app/stadium-map";
import { TacticBoardPanel } from "@/app/tactic-board";
import { TripPlanner } from "@/app/trip-planner";
import { PartnerNetwork } from "@/app/partner-network";
import { DataLab } from "@/app/data-lab/data-lab";
import { ReplayLibrary, ReplayMatch } from "@/features/replay/replay-app";

type LastSync = {
  finished_at: string;
  fetched: number;
  matched: number;
  stored: number;
  status: string;
} | null;

type SourceCapabilities = {
  rss: boolean;
  newsApi: boolean;
  x: boolean;
  xProvider?: "third_party" | "public_source" | "mock" | null;
  translation: boolean;
};

const DEFAULT_CAPABILITIES: SourceCapabilities = {
  rss: true,
  newsApi: false,
  x: false,
  xProvider: null,
  translation: false,
};

type WorkspaceView = "news" | "fixtures" | "matchcenter" | "replay" | "data" | "trip" | "partners" | "map" | "tactics" | "team";

const NAV_GROUPS = [
  { title:"The Newsroom", subtitle:"Verified stories", icon:Newspaper, items:[{view:"news",label:"Latest Dispatch",hint:"ข่าวล่าสุด",icon:Newspaper}] },
  { title:"Football Intelligence", subtitle:"Premier League HQ", icon:ShieldCheck, items:[
    {view:"fixtures",label:"Season Command",hint:"โปรแกรมพรีเมียร์ลีก",icon:CalendarDays},
    {view:"matchcenter",label:"Match Centre",hint:"ศูนย์วิเคราะห์แมตช์",icon:Flag},
    {view:"replay",label:"Broadcast Replay",hint:"จำลองเกมย้อนหลัง",icon:CirclePlay},
    {view:"data",label:"Performance Lab",hint:"ข้อมูลเชิงลึก",icon:BarChart3},
    {view:"map",label:"Ground Atlas",hint:"แผนที่สนาม",icon:MapPinned},
    {view:"tactics",label:"Tactical Board",hint:"แผนการเล่น",icon:Swords},
  ]},
  { title:"Matchday Journey", subtitle:"Beyond the ninety", icon:Plane, items:[
    {view:"trip",label:"Away Day Planner",hint:"วางแผนทริป",icon:Plane},
    {view:"partners",label:"GOG Alliance",hint:"เครือข่ายพาร์ทเนอร์",icon:UsersRound},
    {view:"team",label:"The GOG Crew",hint:"ทีมงาน GOG",icon:ShieldCheck},
  ]},
] as const;

function GroupedNavigation({activeView,onSelect,compact=false}:{activeView:WorkspaceView;onSelect:(view:WorkspaceView)=>void;compact?:boolean}){
  return <nav className={`gog-dock${compact?" compact":""}`} aria-label="GOG navigation">{NAV_GROUPS.map(group=>{
    const active=group.items.some(item=>item.view===activeView),GroupIcon=group.icon;
    return <div className={`dock-group${active?" active":""}`} key={group.title}>
      <button className="dock-trigger" type="button" aria-haspopup="menu"><GroupIcon/><span><b>{group.title}</b><small>{group.subtitle}</small></span><ChevronDown className="dock-chevron"/></button>
      <div className="dock-menu" role="menu">{group.items.map(item=>{const Icon=item.icon;return <button type="button" role="menuitem" className={item.view===activeView?"active":""} onClick={()=>onSelect(item.view as WorkspaceView)} key={item.view}><Icon/><span><b>{item.label}</b><small>{item.hint}</small></span></button>})}</div>
    </div>})}</nav>
}

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

function formatClock(date: Date, timeZone: "Asia/Bangkok" | "Europe/London") {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * วันที่ของแต่ละโซนเวลา — ต้องมีคู่กับนาฬิกาเพราะสองประเทศข้ามวันไม่พร้อมกัน
 * ไทยเร็วกว่าอังกฤษ 6-7 ชั่วโมง ช่วงหัวค่ำของอังกฤษคือดึกของไทยที่ข้ามวันไปแล้ว
 * โชว์แต่เวลาอย่างเดียวจึงอ่านผิดได้ง่ายเวลานัดดึก
 */
function formatDay(date: Date, timeZone: "Asia/Bangkok" | "Europe/London") {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "numeric",
    month: "short",
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

function storyMatchesSource(story: Story, source: NewsSourceDirectoryItem) {
  if (source.kind === "x") {
    return story.sources.some((item) =>
      item.handle?.toLowerCase() === source.id
      || item.url.toLowerCase().includes(`x.com/${source.id.toLowerCase()}/`),
    );
  }
  return story.sources.some((item) =>
    item.name.toLowerCase() === source.label.toLowerCase()
    || item.domain.toLowerCase().endsWith(source.domain),
  );
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

function splitParagraphs(text: string) {
  return text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

// ข้อความที่กด "คัดลอก" แล้วได้ไปวางในคลิป/โพสต์ได้ทันที
function copyBlock(story: Story) {
  return [
    story.titleTh,
    "",
    story.summaryTh,
    ...(story.contentTh ? ["", story.contentTh] : []),
    "",
    ...story.angles.flatMap((angle) => [`• ${angle.hook}`, `  ${angle.why}`]),
    "",
    `EN: ${story.titleEn}`,
    `ที่มา: ${story.sources.map((source) => `${source.name} — ${source.url}`).join("\n       ")}`,
  ].join("\n");
}

// ความคืบหน้าการแปล — API เป็นคำขอเดียวจบ ไม่ได้รายงานเปอร์เซ็นต์จริงระหว่างทาง
// จึงประมาณจากเวลาที่ผ่านไปเทียบเวลาที่คาดไว้ แล้วตรึงไว้ที่ 95% จนกว่าจะได้คำตอบ
// (เวลาที่นับเป็นของจริง — ไว้ให้ดูออกว่าบาร์ยังเดินอยู่ ไม่ได้ค้าง)
export type TranslateProgress = { percent: number; seconds: number };

function TranslateBar({ progress }: { progress: TranslateProgress }) {
  // งานแปลเป็นงานเดียวในเว็บที่พอรู้ความคืบหน้า จึงโชว์เป็นเปอร์เซ็นต์ได้
  // ที่เหลือเป็นการยิง API แล้วรอ ซึ่งต้องใช้วงหมุนแบบไม่มีเลข
  return (
    <div className="translate-progress">
      <AnimatedCircularProgressBar value={progress.percent} />
      <div>
        <b>กำลังแปลเป็นไทย</b>
        <span>ผ่านไป {progress.seconds.toFixed(1)} วินาที</span>
      </div>
    </div>
  );
}

function translateLabel(progress: TranslateProgress) {
  return `กำลังแปล… ${Math.round(progress.percent)}% · ${progress.seconds.toFixed(1)} วิ`;
}

/** ข่าวชิ้นนี้พูดถึงนัดไหน — เซิร์ฟเวอร์จับคู่ให้แล้ว (STEP 71) */
type StoryMatchLink = {
  storyId: string;
  fixtureId: string;
  confidence: "high" | "medium";
  daysBeforeKickoff: number;
  fixture: { homeTh: string; awayTh: string; kickoffUtc: string; kickoffTimeAnnounced: boolean };
};

function MatchLinkBadge({ link, onOpen }: { link: StoryMatchLink; onOpen: () => void }) {
  const date = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short",
  }).format(new Date(link.fixture.kickoffUtc));
  const timing = link.daysBeforeKickoff > 0
    ? `อีก ${link.daysBeforeKickoff} วัน`
    : link.daysBeforeKickoff === 0 ? "วันนี้" : `ผ่านมาแล้ว ${Math.abs(link.daysBeforeKickoff)} วัน`;

  return (
    <button type="button" className={`story-match-link ${link.confidence}`} onClick={onOpen}>
      <CalendarDays size={12} aria-hidden="true" />
      <b>{link.fixture.homeTh} พบ {link.fixture.awayTh}</b>
      <span>{date} · {timing}</span>
      {link.confidence === "medium" && <em>น่าจะเกี่ยวกับนัดนี้</em>}
    </button>
  );
}

function StoryCard({
  story, now, onTranslate, translating, progress, matchLink, onOpenMatch,
}: {
  story: Story; now: Date; onTranslate: (story: Story) => void; translating: boolean;
  progress: TranslateProgress | null; matchLink?: StoryMatchLink; onOpenMatch: (fixtureId: string) => void;
}) {
  const meta = CATEGORY_META[story.category];
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyBlock(story));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* เบราว์เซอร์ไม่ให้เข้าคลิปบอร์ด */ }
  };
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
        {matchLink && <MatchLinkBadge link={matchLink} onOpen={() => onOpenMatch(matchLink.fixtureId)} />}
        <p className="summary-th">{story.summaryTh}</p>

        {/* เนื้อข่าวไทยฉบับเต็มที่เรียบเรียงจากหน้าข่าวต้นฉบับ (ไม่ใช่แค่คำโปรย RSS) */}
        {story.contentTh && (
          <div className="story-body">
            {splitParagraphs(story.contentTh).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}

        <p className="headline-en"><span>EN</span>{story.titleEn}</p>

        {story.articleEn && (
          <details className="story-source-text">
            <summary>
              <FileText size={12} aria-hidden="true" />
              เนื้อข่าวต้นฉบับ (อังกฤษ) · {story.articleEn.length.toLocaleString()} ตัวอักษร
              <ChevronDown size={12} aria-hidden="true" className="chevron" />
            </summary>
            <div>{splitParagraphs(story.articleEn).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          </details>
        )}

        {/* แปลเมื่อกดเท่านั้น — ผลลัพธ์เซฟลงฐานข้อมูลทันที กดคัดลอกไปใช้ต่อได้เลย */}
        <div className="story-actions">
          <button
            type="button"
            className={`story-action ${story.translated ? "ghost" : "primary"}`}
            onClick={() => onTranslate(story)}
            disabled={translating}
          >
            {translating && progress ? (
              <><RefreshCw size={13} className="spin" aria-hidden="true" />{translateLabel(progress)}</>
            ) : story.translated ? (
              <><RefreshCw size={13} aria-hidden="true" />แปลใหม่</>
            ) : (
              <><Languages size={13} aria-hidden="true" />แปลเป็นไทย</>
            )}
          </button>
          <button type="button" className="story-action ghost" onClick={copy} disabled={!story.translated}>
            {copied
              ? <><Check size={13} aria-hidden="true" />คัดลอกแล้ว</>
              : <><Copy size={13} aria-hidden="true" />คัดลอก</>}
          </button>
          {story.translated
            ? <span className="story-action-note done">แปลแล้ว · บันทึกในฐานข้อมูล</span>
            : <span className="story-action-note">ยังไม่แปล — กดเพื่อให้ Claude เรียบเรียงเป็นไทย</span>}
        </div>
        {translating && progress && <TranslateBar progress={progress} />}

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
      {/* ตอนซิงก์ไม่รู้ว่าจะเสร็จเมื่อไหร่ ขึ้นอยู่กับแหล่งข่าวตอบเร็วแค่ไหน
          จึงใช้วงหมุนแบบไม่มีเลข ไม่ใช่เปอร์เซ็นต์ที่เดาเอา */}
      {syncing
        ? <AnimatedCircularProgressBar indeterminate label="กำลังตรวจแหล่งข่าว" />
        : <div className="empty-mark">G</div>}
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

export function Newsroom({ initialView = "news", initialMatchId = null }: { initialView?: WorkspaceView; initialMatchId?: string|null }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeView, setActiveView] = useState<WorkspaceView>(initialView);
  const [replayMatchId,setReplayMatchId]=useState<string|null>(initialMatchId);
  // แมตช์ที่ส่งมาจาก Match Center ผ่านปุ่ม "วางแผนไปดูเกมนี้"
  const [planFixtureKey, setPlanFixtureKey] = useState("");
  const [lastSync, setLastSync] = useState<LastSync>(null);
  const [capabilities, setCapabilities] = useState<SourceCapabilities>(DEFAULT_CAPABILITIES);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [minCredibility, setMinCredibility] = useState(40);
  const [source, setSource] = useState("All");
  const [selectedTopId, setSelectedTopId] = useState("");
  // ข่าวชิ้นไหนพูดถึงนัดไหน — เซิร์ฟเวอร์จับคู่ด้วยพจนานุกรมชื่อทีม (STEP 71)
  const [matchLinks, setMatchLinks] = useState<StoryMatchLink[]>([]);
  const [matchCenterFixtureId, setMatchCenterFixtureId] = useState<string | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const initialSyncAttempted = useRef(false);
  const [translatingIds, setTranslatingIds] = useState<string[]>([]);
  // งานแปลที่กำลังทำอยู่ — เก็บเวลาเริ่มไว้เพื่อนับเวลาจริงและประมาณ %
  const [translateJob, setTranslateJob] = useState<{ startedAt: number; count: number } | null>(null);
  const [translateElapsed, setTranslateElapsed] = useState(0);

  const syncInFlight = useRef(false);

  const loadStories = useCallback(async () => {
    const response = await fetch("/api/stories?days=14", { cache: "no-store" });
    if (!response.ok) throw new Error("ไม่สามารถโหลดคลังข่าวได้");
    const payload = await response.json() as {
      stories: Story[]; lastSync: LastSync; capabilities?: SourceCapabilities; matchLinks?: StoryMatchLink[];
    };
    setStories(payload.stories);
    setLastSync(payload.lastSync);
    setCapabilities(payload.capabilities ?? DEFAULT_CAPABILITIES);
    setMatchLinks(payload.matchLinks ?? []);
    return payload.stories;
  }, []);

  // แปลตามคำสั่ง — ids ว่าง = แปลทุกข่าวที่ยังค้าง · เซิร์ฟเวอร์เซฟลง D1 ให้แล้ว
  const translate = useCallback(async (ids: string[], expected = 1) => {
    setTranslatingIds((current) => [...current, ...ids, ...(ids.length ? [] : ["*"])]);
    setTranslateJob({ startedAt: Date.now(), count: Math.max(expected, 1) });
    setTranslateElapsed(0);
    setError("");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ids.length ? { ids, force: true } : {}),
      });
      const payload = await response.json() as { ok?: boolean; message?: string; error?: string; translated?: number };
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "แปลไม่สำเร็จ");
      if (!payload.translated) throw new Error("ไม่มีข่าวที่ต้องแปล หรือโมเดลไม่ได้ส่งคำแปลกลับมา");
      await loadStories();
    } catch (translateError) {
      setError(translateError instanceof Error ? translateError.message : "แปลไม่สำเร็จ");
    } finally {
      setTranslatingIds((current) => current.filter((id) => !ids.includes(id) && id !== "*"));
      setTranslateJob(null);
    }
  }, [loadStories]);

  // นับเวลาจริงระหว่างรอคำตอบ — เดินทุก 100ms ให้บาร์ขยับเห็นชัดว่าไม่ค้าง
  useEffect(() => {
    if (!translateJob) return;
    const timer = window.setInterval(() => setTranslateElapsed(Date.now() - translateJob.startedAt), 100);
    return () => window.clearInterval(timer);
  }, [translateJob]);

  // ประมาณ ~9 วิ/ข่าว + โอเวอร์เฮด แล้วตรึงที่ 95% จนกว่าคำตอบจะกลับมา
  const translateProgress = useMemo<TranslateProgress | null>(() => {
    if (!translateJob) return null;
    const expectedMs = translateJob.count * 9_000 + 3_000;
    return {
      percent: Math.min(95, (translateElapsed / expectedMs) * 100),
      seconds: translateElapsed / 1000,
    };
  }, [translateJob, translateElapsed]);

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

  const filteredStories = useMemo(() => stories.filter((story) => {
    const selectedSource = NEWS_SOURCE_DIRECTORY.find((item) => item.id === source);
    return (category === "All" || story.category === category)
      && story.credibility >= minCredibility
      && (source === "All" || Boolean(selectedSource && storyMatchesSource(story, selectedSource)));
  }), [stories, category, minCredibility, source]);

  const untranslatedCount = useMemo(() => stories.filter((story) => !story.translated).length, [stories]);

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

  // สโลแกน + พาดหัวข่าวล่าสุด 4 ข่าว หมุนสลับกันบนฮีโร่
  const heroSlides = useMemo(() => {
    type HeroSlide = { id: string; kind: "tagline" | "story"; headline: string; source: string; publishedAt: string };
    const slides: HeroSlide[] = [{ id: "tagline", kind: "tagline", headline: "", source: "", publishedAt: "" }];
    for (const story of stories.slice(0, 4)) {
      const source = story.sources[0];
      slides.push({
        id: story.id,
        kind: "story",
        headline: story.translated && story.titleTh ? story.titleTh : story.titleEn,
        source: source?.name ?? "",
        publishedAt: source?.publishedAt ?? "",
      });
    }
    return slides;
  }, [stories]);

  // ทุกสไลด์วางซ้อนกันอยู่ในกล่องเดียว แล้วสลับด้วย opacity ล้วน ๆ
  // ตัวเก่าจึงจางออกพร้อมตัวใหม่จางเข้าจริง ๆ ไม่มี timer มาคุมจังหวะเฟด
  // (ของเดิมใช้สองจังหวะ out → swap → in แล้วจับเวลาชนกันเอง เฟดเลยไม่เคยได้เล่น)
  const [heroIndex, setHeroIndex] = useState(0);

  // ตั้งเวลาใหม่ทุกครั้งที่สไลด์เปลี่ยน — กดจุดเลือกเองแล้วได้เวลาดูเต็ม 6.5 วินาที
  // ถ้าใช้ setInterval ตัวเดียวยาว ๆ จังหวะเดิมจะเดินต่อ กดปุ๊บอาจโดนสลับทันที
  useEffect(() => {
    if (heroSlides.length < 2) return;
    const timer = window.setTimeout(() => {
      setHeroIndex((current) => (current + 1) % heroSlides.length);
    }, HERO_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [heroIndex, heroSlides.length]);

  // จำนวนข่าวเปลี่ยนได้ระหว่างซิงก์ จึงหารเศษตอนอ่านแทนการรีเซ็ต index
  const activeHero = heroIndex % heroSlides.length;

  const switchView = (view: WorkspaceView) => {
    setActiveView(view);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  return (
    <div className="newsroom-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => switchView("news")} aria-label="GOG Newsroom home">
          <span className="brand-logo" aria-hidden="true" />
          <span><b>GOG</b> NEWSROOM<small>GENIUS ON THE GROUND · DM ENGINE™</small></span>
        </button>
        <GroupedNavigation activeView={activeView} onSelect={(view)=>{if(view==="replay")setReplayMatchId(null);switchView(view)}} compact />
        <div className="header-status">
          <span className="live-pill"><i /> LIVE</span>
          <div className="dual-clock" role="group" aria-label="เวลาไทยและเวลาอังกฤษ">
            <div className="clock clock-th">
              <b>{now ? formatClock(now, "Asia/Bangkok") : "--:--:--"}</b>
              <small>{now ? `${formatDay(now, "Asia/Bangkok")} · ` : ""}ไทย · ICT</small>
            </div>
            <span className="clock-divider" aria-hidden="true" />
            <div className="clock clock-uk" title="เวลาอังกฤษปรับ GMT และ BST อัตโนมัติ">
              <b>{now ? formatClock(now, "Europe/London") : "--:--:--"}</b>
              <small>{now ? `${formatDay(now, "Europe/London")} · ` : ""}อังกฤษ · GMT/BST</small>
            </div>
          </div>
          <button className="sync-button" type="button" onClick={() => void sync()} disabled={syncing} aria-label="ซิงก์ข่าวล่าสุด">
            <span className={syncing ? "spinning" : ""}>↻</span>
          </button>
        </div>
        {/* แถบนัด — ใช้ now ตัวเดียวกับนาฬิกา ไม่ตั้งตัวจับเวลาซ้อนอีกตัว */}
        <MatchStrip now={now} />
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span /> ข่าวปีศาจแดง • ระบบโดย DM ENGINE™</div>

            {/* สโลแกนสลับกับพาดหัวข่าวล่าสุด — เปลี่ยนเองทุก 6.5 วินาที */}
            <div className="hero-rotator">
              <div className="hero-rotator-stage">
                {heroSlides.map((slide, index) => {
                  const active = index === activeHero;
                  return (
                    <div
                      key={slide.id}
                      className={`hero-rotator-slide${active ? " active" : ""}`}
                      aria-hidden={!active}
                    >
                      <span className="hero-slide-eyebrow">
                        {slide.kind === "tagline" ? "GOG NEWSROOM" : "อัปเดตล่าสุด"}
                      </span>

                      {slide.kind === "tagline" ? (
                        <h1 className="hero-headline">
                          รู้จริงก่อนใคร<br />
                          <em><AuroraText>เชื่อเฉพาะที่ยืนยันได้</AuroraText></em>
                        </h1>
                      ) : (
                        /* พาดหัวข่าวใช้โทนสว่าง (ขาว → ทองอ่อน) ไม่ใช่โทนแดงเข้มแบบสโลแกน
                           เพราะข้อความยาวกว่าและตัวเล็กกว่า ถ้าไล่สีเข้มจะอ่านยาก
                           และหมุนช้ากว่าเพื่อไม่ให้แย่งความสนใจไปจากตัวข่าวเอง */
                        <p className="hero-headline story">
                          <AuroraText colors={["#ffffff", "#f0cc78", "#ffffff", "#e8d9b5"]} speed={0.6}>
                            {slide.headline}
                          </AuroraText>
                        </p>
                      )}

                      <p className="hero-slide-meta">
                        {slide.kind === "tagline" ? (
                          <span>คัดข่าวจาก {NEWS_SOURCE_DIRECTORY.length} แหล่งต้นฉบับ · ตรวจแล้วทุกชิ้น</span>
                        ) : (
                          <>
                            {slide.source && <b>{slide.source}</b>}
                            {slide.publishedAt && now && (
                              <time dateTime={slide.publishedAt}>{relativeTime(slide.publishedAt, now)}</time>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>

              {heroSlides.length > 1 && (
                <div className="hero-rotator-dots" role="tablist" aria-label="สลับพาดหัว">
                  {heroSlides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      role="tab"
                      aria-selected={index === activeHero}
                      aria-label={slide.kind === "tagline" ? "สโลแกน" : slide.headline}
                      className={index === activeHero ? "active" : ""}
                      onClick={() => setHeroIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            <p>รวมทุกความเคลื่อนไหวของแมนเชสเตอร์ ยูไนเต็ด<br />กลั่นจากแหล่งข่าวต้นฉบับ เพื่อแฟนผีแดงชาวไทย</p>
            <div className="hero-stats">
              <div><strong>{stories.length || "—"}</strong><span>ข่าวในระบบ</span></div>
              <div><strong>{verifiedCount || "—"}</strong><span>ยืนยันแล้ว</span></div>
              <div><strong>{NEWS_SOURCE_DIRECTORY.length}</strong><span>แหล่งข่าว</span></div>
            </div>
            {/* ย้ายมาอยู่ใต้ตัวเลขฝั่งซ้าย — เดิมลอยทับรูปคนที่มุมขวาล่าง */}
            <div className="hero-update">
              <span>LAST SYNCED</span>
              <b>{lastSync && now ? relativeTime(lastSync.finished_at, now) : syncing ? "กำลังซิงก์…" : lastSync ? "ซิงก์แล้ว" : "ยังไม่เคยซิงก์"}</b>
              <small>{lastSync ? `${lastSync.matched} รายการตรงเกณฑ์ · ${lastSync.stored} คลัสเตอร์` : "RSS พร้อมทำงานโดยไม่ต้องใช้ API key"}</small>
            </div>
          </div>
          <div className="hero-insignia" aria-hidden="true">
            <span className="hero-brand-stamp">GENIUS ON THE GROUND | ภารกิจบุกถิ่นผี</span>
          </div>
          {/* ป้ายชื่อคนในภาพ — เกาะใต้ตัวคนทั้งสอง ไม่ให้ทับโลโก้ GOG ที่เป็นพื้นหลัง */}
          <ul className="hero-cast">
            <li>
              <b>YO_THEERAT</b>
              <small className="gold">Genius on the Ground</small>
              <small className="gold">Experience Host</small>
            </li>
            <li>
              <b>AUM_FOOTBALLGENIUS</b>
              <small className="gold">Football Genius</small>
              <small className="gold">Founder of G.O.G.</small>
            </li>
          </ul>
        </section>

        <div className="workspace-dock"><GroupedNavigation activeView={activeView} onSelect={(view)=>{if(view==="replay")setReplayMatchId(null);switchView(view)}} /></div>

        {activeView === "news" ? <>
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

        <NewsFlow
          storyCount={stories.length}
          verifiedCount={verifiedCount}
          lastSync={lastSync}
          syncing={syncing}
          activeSource={source}
          matchLinkCount={matchLinks.length}
          onOpenOutput={(view) => {
            if (view === "news") { document.getElementById("news")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
            switchView(view);
          }}
          onFilterSource={(label) => {
            setSource(label ?? "All");
            document.getElementById("news")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />

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
                {NEWS_SOURCE_DIRECTORY.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}{option.kind === "x" && !capabilities.x ? " · รอ X Provider" : ""}
                  </option>
                ))}
              </select>
            </label>
            <details className="source-directory">
              <summary>
                <span>รายการติดตาม</span>
                <b>{NEWS_SOURCE_DIRECTORY.length}</b>
              </summary>
              <div className="source-directory-popover">
                <div className="source-directory-heading">
                  <div><span>แหล่งข่าวที่กำหนด</span><strong>เว็บไซต์ 3 · X 15</strong></div>
                  <small><i className="ready" /> พร้อม <i /> รอ Provider</small>
                </div>
                <div className="source-directory-grid">
                  {NEWS_SOURCE_DIRECTORY.map((item) => {
                    const ready = item.kind === "rss" || capabilities.x;
                    return (
                      <a key={item.id} href={item.homepage} target="_blank" rel="noreferrer" title={`เปิด ${item.label}`}>
                        <span className={`source-status-dot ${ready ? "ready" : ""}`} />
                        <b>{item.label}</b>
                        <small>{item.kind === "rss" ? "RSS" : ready ? "X COLLECTOR" : "รอ Provider"}</small>
                        <em>↗</em>
                      </a>
                    );
                  })}
                </div>
                {!capabilities.x && (
                  <p>ตั้งค่า X Provider ที่ได้รับอนุญาตหรือแหล่งฟีดสาธารณะ เพื่อซิงก์บัญชี X ทั้ง 15 บัญชีผ่านระบบ Collector</p>
                )}
              </div>
            </details>
          </div>
        </section>

        {error && <div className="error-banner" role="status"><span>!</span>{error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <div className="content-layout">
          <section className="feed" id="news" aria-labelledby="latest-heading">
            <div className="feed-title-row">
              <div><span className="eyebrow">VERIFIED NEWS FEED</span><h2 id="latest-heading">ข่าวล่าสุด</h2></div>
              <div className="feed-title-actions">
                {untranslatedCount > 0 && (
                  <button
                    type="button"
                    className="story-action primary"
                    onClick={() => translate([], untranslatedCount)}
                    disabled={translatingIds.length > 0 || !capabilities.translation}
                    title={capabilities.translation ? "" : "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บน Worker"}
                  >
                    {translatingIds.includes("*") && translateProgress ? (
                      <><RefreshCw size={13} className="spin" aria-hidden="true" />{translateLabel(translateProgress)}</>
                    ) : (
                      <><Languages size={13} aria-hidden="true" />แปลที่ยังค้าง {untranslatedCount} ข่าว</>
                    )}
                  </button>
                )}
                <span>{filteredStories.length} เรื่อง</span>
                {translatingIds.includes("*") && translateProgress && <TranslateBar progress={translateProgress} />}
              </div>
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
                  {items.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      now={now ?? new Date(0)}
                      onTranslate={(target) => translate([target.id])}
                      translating={translatingIds.includes(story.id) || translatingIds.includes("*")}
                      progress={translateProgress}
                      matchLink={matchLinks.find((link) => link.storyId === story.id)}
                      onOpenMatch={(fixtureId) => { setMatchCenterFixtureId(fixtureId); switchView("matchcenter"); }}
                    />
                  ))}
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

        <GogHubBento stories={stories} verifiedCount={verifiedCount} onNavigate={switchView} />
        </> : activeView === "fixtures" ? <FixturesPanel /> : activeView === "replay" ? (replayMatchId?<ReplayMatch embedded matchId={replayMatchId} onBack={()=>setReplayMatchId(null)}/>:<ReplayLibrary embedded onOpenMatch={setReplayMatchId}/>) : activeView === "data" ? <DataLab embedded /> : activeView === "matchcenter" ? (
          <MatchCenter
            onPlanTrip={(fixtureKey) => { setPlanFixtureKey(fixtureKey); switchView("trip"); }}
            openFixtureId={matchCenterFixtureId}
          />
        ) : activeView === "trip" ? (
          // key บังคับให้สร้างใหม่เมื่อส่งแมตช์ใหม่เข้ามา ไม่งั้น state เดิมค้างและไม่เลือกแมตช์ให้
          <TripPlanner key={planFixtureKey || "default"} initialFixtureKey={planFixtureKey || undefined} />
        ) : activeView === "partners" ? <PartnerNetwork /> : activeView === "map" ? <StadiumMapPanel /> : activeView === "tactics" ? <TacticBoardPanel /> : <GogTeamPanel />}
      </main>

      <footer>
        <div className="footer-brand"><span className="brand-logo" aria-hidden="true" /><div><b>GOG NEWSROOM</b><small>GENIUS ON THE GROUND | ภารกิจบุกถิ่นผี</small></div></div>
        <p>นำเสนอเฉพาะพาดหัวและสรุปสั้นเพื่อการติดตามข่าว · ลิขสิทธิ์บทความเป็นของแหล่งข่าวต้นฉบับ<strong>ระบบโดย DM ENGINE™</strong></p>
        <div><span><i /> ระบบออนไลน์</span><a href="#top">กลับด้านบน ↑</a></div>
      </footer>

      <AnthemPlayer />
    </div>
  );
}
