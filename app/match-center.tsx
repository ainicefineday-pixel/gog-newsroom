"use client";

// GOG FOOTBALL MATCH CENTER — หน้าเว็บ (เฟส 2)
// ---------------------------------------------------------------------------
// คุยกับ /api/football/* ของ GOG เท่านั้น ไม่เคยเรียกผู้ให้บริการตรง (STEP 8)
// ทุกส่วนเรนเดอร์ตาม capabilities ที่เซิร์ฟเวอร์คำนวณมา ไม่มีข้อมูลก็ขึ้นเหตุผลว่าทำไม
// ไม่ใช่กล่องเทาว่างเปล่าและไม่ใช่ตัวเลขปลอม (STEP 17, 84)

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Info, MapPin, Plane, Star, TriangleAlert } from "lucide-react";
import { FIXTURE_STATE_TH, STAT_LABELS } from "@/services/football/thai";
import { UNAVAILABLE_REASON_TH } from "@/services/football/capabilities";
import { thaiFullDate, thaiShortDate } from "@/services/football/normalize";
import { buildMatchTravelPlan } from "@/services/travel/matchToTrip";
import { gogStadium } from "@/config/gog-stadiums";
import { TRAVEL_TIER_LABEL, travelWorthiness } from "@/services/football/travelWorthy";
import { SEARCH_KIND_LABEL, searchFootball } from "@/services/football/search";
import { formatThb } from "@/services/pricing";
import { BUDGET_LABELS, type BudgetStyle } from "@/services/trip/types";
import type {
  GOGEvent, GOGFixture, GOGLineup, GOGMatchBundle, GOGStanding, GOGTeamStats,
} from "@/services/football/types";
import type { ControlScoreResult } from "@/services/intelligence/controlScore";
import type { MatchStory } from "@/services/intelligence/matchStory";
import type { KeyMoment } from "@/services/intelligence/keyMoments";

type MatchTab = "overview" | "lineups" | "events" | "stats" | "h2h" | "table" | "venue" | "travel";

const TAB_LABELS: Array<[MatchTab, string]> = [
  ["overview", "ภาพรวม"],
  ["lineups", "ไลน์อัพ"],
  ["events", "เหตุการณ์"],
  ["stats", "สถิติ"],
  ["h2h", "H2H"],
  ["table", "ตารางคะแนน"],
  ["venue", "สนาม"],
  ["travel", "ไปดูเกมนี้"],
];

/** เกมที่ผู้ใช้กดว่าอยากไปดู — เก็บในเครื่อง ยังไม่มีระบบบัญชี (STEP 68) */
const SAVED_MATCHES_KEY = "gog:saved-matches";

const EVENT_ICON: Record<GOGEvent["type"], string> = {
  goal: "⚽", own_goal: "⚽", penalty: "⚽", penalty_miss: "✕",
  yellow_card: "🟨", red_card: "🟥", second_yellow: "🟥",
  substitution: "⇄", var: "VAR",
};

/** สถานะ "ยังไม่มีข้อมูล" ที่บอกเหตุผลเสมอ ไม่ใช่ปล่อยว่าง (STEP 84) */
function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="mc-unavailable">
      <Info size={14} aria-hidden="true" />
      <span>{reason}</span>
    </div>
  );
}

function StateBadge({ fixture }: { fixture: GOGFixture }) {
  return (
    <span className={`mc-state mc-state-${fixture.state}`}>
      {fixture.state === "live" && fixture.minute !== null
        ? `${FIXTURE_STATE_TH.live} ${fixture.minute}'`
        : FIXTURE_STATE_TH[fixture.state]}
    </span>
  );
}

function MatchCard({ fixture, onOpen, saved, onToggleSave, showWorth }: {
  fixture: GOGFixture;
  onOpen: () => void;
  saved: boolean;
  onToggleSave: () => void;
  /** โชว์ป้ายความคุ้มค่าบินไปดู — เปิดเฉพาะตอนเรียงตามความน่าไป */
  showWorth?: boolean;
}) {
  const decided = fixture.homeScore !== null && fixture.awayScore !== null;
  const worth = showWorth ? travelWorthiness(fixture) : null;
  return (
    <article className={`mc-card ${fixture.state === "live" ? "live" : ""} ${saved ? "saved" : ""}`}>
      <header>
        <span className="mc-card-week">{fixture.matchweek ? `นัดที่ ${fixture.matchweek}` : fixture.competitionName}</span>
        <span className="mc-card-head-right">
          <button
            type="button"
            className={`mc-save ${saved ? "on" : ""}`}
            aria-pressed={saved}
            aria-label={saved ? "เอาออกจากเกมที่อยากไปดู" : "บันทึกเป็นเกมที่อยากไปดู"}
            onClick={onToggleSave}
          >
            <Star size={13} aria-hidden="true" />
          </button>
          <StateBadge fixture={fixture} />
        </span>
      </header>

      <div className="mc-card-teams">
        <span className="mc-card-team">
          <b>{fixture.home.nameTh}</b>
          <small>{fixture.home.name}</small>
        </span>
        <span className="mc-card-score">
          {decided ? `${fixture.homeScore}–${fixture.awayScore}` : "vs"}
        </span>
        <span className="mc-card-team away">
          <b>{fixture.away.nameTh}</b>
          <small>{fixture.away.name}</small>
        </span>
      </div>

      <dl className="mc-card-meta">
        <div><dt>วันแข่ง</dt><dd>{thaiShortDate(fixture.kickoffUtc)}</dd></div>
        <div><dt>เวลาไทย</dt><dd>{fixture.kickoffBangkok} น.</dd></div>
        <div><dt>เวลาอังกฤษ</dt><dd>{fixture.kickoffLocal}</dd></div>
      </dl>

      {fixture.venue && (
        <p className="mc-card-venue"><MapPin size={11} aria-hidden="true" /> {fixture.venue.name} · {fixture.venue.city}</p>
      )}

      {worth && (
        <div className={`mc-worth ${worth.tier}`}>
          <span className="mc-worth-head">
            <b>{TRAVEL_TIER_LABEL[worth.tier]}</b>
            <em>{worth.score}/100</em>
          </span>
          <ul>{worth.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}

      <button type="button" className="mc-card-cta" onClick={onOpen}>ดู Match Center</button>
    </article>
  );
}

function StatBar({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  // ค่าที่เป็น null คือไม่มีข้อมูล ไม่ใช่ศูนย์ จึงไม่วาดแถบเลย (STEP 115)
  if (home === null || away === null) return null;
  const total = home + away;
  const homeShare = total === 0 ? 50 : (home / total) * 100;
  return (
    <div className="mc-stat">
      <span className="mc-stat-value">{home}</span>
      <span className="mc-stat-body">
        <b>{label}</b>
        <span className="mc-stat-track">
          <i className="home" style={{ width: `${homeShare}%` }} />
          <i className="away" style={{ width: `${100 - homeShare}%` }} />
        </span>
      </span>
      <span className="mc-stat-value away">{away}</span>
    </div>
  );
}

function LineupPitch({ lineup, teamName }: { lineup: GOGLineup; teamName: string }) {
  if (lineup.startXI.length === 0) return null;
  // grid ของผู้ให้บริการมาเป็น แถว:คอลัมน์ — จัดเป็นแถวตามตำแหน่งเพื่อวาดผัง
  const rows = new Map<number, typeof lineup.startXI>();
  for (const player of lineup.startXI) {
    const row = player.gridX ?? 0;
    rows.set(row, [...(rows.get(row) ?? []), player]);
  }
  const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="mc-pitch-block">
      <header>
        <b>{teamName}</b>
        {lineup.formation && <span className="mc-formation">{lineup.formation}</span>}
        <span className={`mc-lineup-status ${lineup.status}`}>
          {lineup.status === "confirmed" ? "ยืนยันแล้ว" : lineup.status === "predicted" ? "คาดการณ์" : "ยังไม่ประกาศ"}
        </span>
      </header>
      <div className="mc-pitch">
        {ordered.map(([row, players]) => (
          <div className="mc-pitch-row" key={row}>
            {players.map((player) => (
              <span className="mc-pitch-player" key={`${player.name}-${player.number}`}>
                <b>{player.number ?? "–"}</b>
                <small>{player.name.split(" ").slice(-1)[0]}</small>
              </span>
            ))}
          </div>
        ))}
      </div>
      {lineup.bench.length > 0 && (
        <p className="mc-bench">
          <span>ตัวสำรอง</span>
          {lineup.bench.map((player) => `${player.number ?? "–"} ${player.name}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

export function MatchCenter({ onPlanTrip }: { onPlanTrip?: (tripFixtureKey: string) => void }) {
  const [fixtures, setFixtures] = useState<GOGFixture[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<GOGMatchBundle | null>(null);
  const [story, setStory] = useState<MatchStory | null>(null);
  const [moments, setMoments] = useState<KeyMoment[]>([]);
  const [control, setControl] = useState<ControlScoreResult | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [tab, setTab] = useState<MatchTab>("overview");
  const [showControlMath, setShowControlMath] = useState(false);
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"upcoming" | "finished" | "all">("upcoming");
  // อ่านเวลาปัจจุบันหลัง hydrate เท่านั้น อ่านตอนเรนเดอร์จะทำให้ผลไม่นิ่งและ markup
  // ฝั่งเซิร์ฟเวอร์ไม่ตรงกับ client · เดินนาฬิกาทุกนาทีเพื่อให้สถานะเกมสดขยับตาม
  const [now, setNow] = useState(0);
  // เกมที่อยากไปดู (STEP 68) — เก็บในเครื่องผู้ใช้ ยังไม่มีระบบบัญชี
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<"date" | "worth">("date");
  // เครื่องมือของทีมพัฒนา เปิดด้วย ?datalab=1 — ผู้ใช้ทั่วไปไม่เห็น (STEP 123)
  const [dataLab, setDataLab] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    window.queueMicrotask(() => {
      setDataLab(new URLSearchParams(window.location.search).get("datalab") === "1");
    });
  }, []);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    window.queueMicrotask(tick);
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      try {
        const saved = window.localStorage.getItem(SAVED_MATCHES_KEY);
        if (saved) setSavedIds(JSON.parse(saved) as string[]);
      } catch { /* localStorage ถูกปิด = เริ่มจากลิสต์ว่าง */ }
    });
  }, []);

  const toggleSaved = useCallback((fixtureId: string) => {
    setSavedIds((current) => {
      const next = current.includes(fixtureId)
        ? current.filter((item) => item !== fixtureId)
        : [...current, fixtureId];
      try { window.localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(next)); } catch { /* ไม่เป็นไร */ }
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/football/fixtures")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { fixtures?: GOGFixture[]; demo?: boolean } | null) => {
        if (!alive || !payload) return;
        setFixtures(payload.fixtures ?? []);
        setDemo(Boolean(payload.demo));
      })
      .catch(() => { if (alive) setFixtures([]); });
    return () => { alive = false; };
  }, []);

  const openMatch = useCallback((fixtureId: string) => {
    setOpenId(fixtureId);
    setTab("overview");
    setLoadingMatch(true);
    setBundle(null);
    fetch(`/api/football/match/${fixtureId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: {
        bundle?: GOGMatchBundle; story?: MatchStory | null;
        keyMoments?: KeyMoment[]; control?: ControlScoreResult | null;
      } | null) => {
        setBundle(payload?.bundle ?? null);
        setStory(payload?.story ?? null);
        setMoments(payload?.keyMoments ?? []);
        setControl(payload?.control ?? null);
      })
      .catch(() => setBundle(null))
      .finally(() => setLoadingMatch(false));
  }, []);

  // ค้นหารวม — พิมพ์ไทยหรืออังกฤษก็เจอเหมือนกัน (STEP 70)
  const searchHits = useMemo(() => searchFootball(query, fixtures ?? []), [query, fixtures]);

  const months = useMemo(() => {
    const set = new Set((fixtures ?? []).map((item) => item.kickoffUtc.slice(0, 7)));
    return [...set].sort();
  }, [fixtures]);

  const visible = useMemo(() => {
    return (fixtures ?? [])
      .filter((item) => {
        if (savedOnly && !savedIds.includes(item.id)) return false;
        if (monthFilter !== "all" && !item.kickoffUtc.startsWith(monthFilter)) return false;
        // now = 0 คือยังไม่ได้อ่านเวลาหลัง hydrate — ยังไม่กรองตามเวลาเพื่อไม่ให้การ์ดกระพริบ
        if (now === 0) return true;
        const started = new Date(item.kickoffUtc).getTime() <= now;
        if (statusFilter === "upcoming" && started) return false;
        if (statusFilter === "finished" && !started) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "worth") {
          const diff = travelWorthiness(b).score - travelWorthiness(a).score;
          if (diff !== 0) return diff;
        }
        return a.kickoffUtc.localeCompare(b.kickoffUtc);
      });
  }, [fixtures, monthFilter, statusFilter, now, savedOnly, savedIds, sort]);

  const homeStats = bundle?.teamStats.find((row) => row.teamId === bundle.fixture.home.id);
  const awayStats = bundle?.teamStats.find((row) => row.teamId === bundle.fixture.away.id);
  // เส้นทางเดินทางและราคาโดยประมาณของแมตช์นี้ — คิดจาก service ตัวเดียวกับหน้าวางแผนทริป
  const travel = useMemo(() => (bundle ? buildMatchTravelPlan(bundle.fixture) : null), [bundle]);
  // คู่มือสนามที่ทีมงานเขียนเอง — ไม่พึ่งผู้ให้บริการ ไม่มีก็ขึ้นสถานะตรง ๆ
  const stadium = useMemo(() => gogStadium(bundle?.fixture.venue?.name), [bundle]);

  return (
    <section className="mc-view" aria-labelledby="mc-heading">
      <div className="mc-hero">
        <div>
          <span className="eyebrow">GOG FOOTBALL MATCH CENTER</span>
          <h2 id="mc-heading">เข้าใจเกม · รู้สึกถึงเกม · วางแผนไปดูเกม</h2>
          <p>โปรแกรมพรีเมียร์ลีก ผลการแข่งขัน และข้อมูลเชิงลึกภาษาไทย ต่อยอดไปวางแผนทริปได้ในที่เดียว</p>
        </div>
        {demo && (
          <span className="mc-demo-badge" title="ยังไม่ได้ใส่คีย์ผู้ให้บริการข้อมูล">
            <TriangleAlert size={13} aria-hidden="true" /> DEMO DATA — ข้อมูลตัวอย่าง ไม่ใช่ผลจริง
          </span>
        )}
      </div>

      {!openId && (
        <div className="trip-block">
          <header className="trip-block-head">
            <div>
              <span className="eyebrow">FIXTURE CALENDAR</span>
              <h3><CalendarDays size={15} aria-hidden="true" /> ปฏิทินโปรแกรมแข่ง</h3>
            </div>
            <div className="trip-filters">
              {([["upcoming", "กำลังจะแข่ง"], ["finished", "แข่งจบแล้ว"], ["all", "ทั้งหมด"]] as const).map(([value, label]) => (
                <button key={value} type="button" className={statusFilter === value ? "active" : ""} onClick={() => setStatusFilter(value)}>
                  {label}
                </button>
              ))}
              <button type="button" className={savedOnly ? "active" : ""} onClick={() => setSavedOnly((open) => !open)}>
                เกมที่อยากไปดู{savedIds.length > 0 ? ` (${savedIds.length})` : ""}
              </button>
            </div>
          </header>

          <div className="mc-search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาสโมสร สนาม หรือแมตช์ — พิมพ์ไทยหรืออังกฤษก็ได้"
              aria-label="ค้นหาสโมสร สนาม หรือแมตช์"
            />
            {query.trim().length > 0 && (
              <div className="mc-search-results">
                {searchHits.length === 0 ? (
                  <p className="mc-search-empty">ไม่พบผลลัพธ์สำหรับ &ldquo;{query}&rdquo;</p>
                ) : (
                  searchHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      className="mc-search-hit"
                      onClick={() => {
                        if (hit.kind === "fixture") { openMatch(hit.fixtureId); setQuery(""); return; }
                        // สโมสรกับสนามยังไม่มีหน้าของตัวเอง — ใช้คำค้นกรองปฏิทินไปก่อน
                        setStatusFilter("all");
                        setMonthFilter("all");
                      }}
                    >
                      <span className={`mc-search-kind ${hit.kind}`}>{SEARCH_KIND_LABEL[hit.kind]}</span>
                      <span>
                        <strong>{hit.title}</strong>
                        <small>{hit.subtitle}</small>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="fixture-sort">
            <span>เรียงตาม</span>
            <button type="button" className={sort === "date" ? "active" : ""} onClick={() => setSort("date")}>วันที่</button>
            <button type="button" className={sort === "worth" ? "active" : ""} onClick={() => setSort("worth")}>คุ้มค่าบินไปดู</button>
          </div>

          <div className="fixture-sort">
            <span>เดือน</span>
            <button type="button" className={monthFilter === "all" ? "active" : ""} onClick={() => setMonthFilter("all")}>ทุกเดือน</button>
            {months.map((month) => (
              <button key={month} type="button" className={monthFilter === month ? "active" : ""} onClick={() => setMonthFilter(month)}>
                {new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "short", year: "2-digit" }).format(new Date(`${month}-01T00:00:00Z`))}
              </button>
            ))}
          </div>

          {fixtures === null ? (
            <div className="mc-skeleton-grid">{[0, 1, 2, 3].map((key) => <span key={key} className="mc-skeleton" />)}</div>
          ) : visible.length === 0 ? (
            <Unavailable
              reason={savedOnly
                ? "ยังไม่ได้บันทึกเกมไหนไว้ — กดรูปดาวบนการ์ดแมตช์เพื่อเก็บเกมที่อยากไปดู"
                : "ไม่มีแมตช์ตรงเงื่อนไขที่เลือก ลองเปลี่ยนเดือนหรือสถานะดู"}
            />
          ) : (
            <div className="mc-grid">
              {visible.map((fixture) => (
                <MatchCard
                  key={fixture.id}
                  fixture={fixture}
                  onOpen={() => openMatch(fixture.id)}
                  saved={savedIds.includes(fixture.id)}
                  onToggleSave={() => toggleSaved(fixture.id)}
                  showWorth={sort === "worth"}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {openId && (
        <div className="trip-block mc-detail">
          <button type="button" className="mc-back" onClick={() => { setOpenId(null); setBundle(null); }}>
            ← กลับไปปฏิทินโปรแกรมแข่ง
          </button>

          {loadingMatch && <div className="mc-skeleton-grid">{[0, 1, 2].map((key) => <span key={key} className="mc-skeleton tall" />)}</div>}

          {!loadingMatch && !bundle && <Unavailable reason="โหลดข้อมูลแมตช์นี้ไม่สำเร็จ — ลองใหม่อีกครั้ง" />}

          {bundle && (
            <>
              {/* ── STEP 20 · หัวแมตช์ ─────────────────────────────────── */}
              <div className="mc-match-hero">
                <div className="mc-match-top">
                  <span>{bundle.fixture.competitionName}{bundle.fixture.matchweek ? ` · นัดที่ ${bundle.fixture.matchweek}` : ""}</span>
                  <StateBadge fixture={bundle.fixture} />
                </div>

                <div className="mc-match-teams">
                  <span className="mc-match-team">
                    <b>{bundle.fixture.home.nameTh}</b>
                    <small>{bundle.fixture.home.name}</small>
                  </span>
                  <span className="mc-match-score">
                    {bundle.capabilities.score
                      ? `${bundle.fixture.homeScore}–${bundle.fixture.awayScore}`
                      : bundle.fixture.kickoffBangkok}
                  </span>
                  <span className="mc-match-team">
                    <b>{bundle.fixture.away.nameTh}</b>
                    <small>{bundle.fixture.away.name}</small>
                  </span>
                </div>

                <dl className="mc-match-meta">
                  <div><dt>วันแข่ง</dt><dd>{thaiFullDate(bundle.fixture.kickoffUtc)}</dd></div>
                  <div><dt>เวลาอังกฤษ</dt><dd>{bundle.fixture.kickoffLocal}</dd></div>
                  <div><dt>เวลาไทย</dt><dd>{bundle.fixture.kickoffBangkok} น.</dd></div>
                  {bundle.fixture.venue && <div><dt>สนาม</dt><dd>{bundle.fixture.venue.name} · {bundle.fixture.venue.city}</dd></div>}
                </dl>

                {!bundle.fixture.scheduleConfirmed && (
                  <p className="mc-schedule-note">
                    <TriangleAlert size={12} aria-hidden="true" />
                    วันและเวลาแข่งขันอาจเปลี่ยนตามการถ่ายทอดสดและรายการแข่งขันอื่น
                    โปรดตรวจสอบก่อนจองบริการที่คืนเงินไม่ได้
                  </p>
                )}
              </div>

              <nav className="mc-tabs" aria-label="ส่วนต่าง ๆ ของแมตช์">
                {TAB_LABELS.map(([value, label]) => (
                  <button key={value} type="button" className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
                    {label}
                  </button>
                ))}
              </nav>

              {tab === "overview" && (
                <div className="mc-panel">
                  {story ? (
                    <div className="mc-story">
                      <span className="eyebrow">GOG MATCH STORY</span>
                      <p className="mc-story-short">{story.short}</p>
                      <ul>
                        {story.insights.map((insight) => (
                          <li key={insight.type + insight.text}>
                            <span className={`mc-confidence ${insight.confidence.toLowerCase()}`}>{insight.confidence}</span>
                            {insight.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <Unavailable reason="ยังไม่มีข้อมูลพอจะสรุปเกมนี้ — สถิติจะมาหลังเริ่มแข่ง" />
                  )}

                  {control && (
                    <div className="mc-control">
                      <header>
                        <b>GOG CONTROL SCORE</b>
                        <span>ดัชนีภาพรวมจากสถิติการแข่งขันของ GOG</span>
                      </header>
                      <div className="mc-control-bar">
                        <span>{control.homeScore}</span>
                        <i><em style={{ width: `${control.homeScore}%` }} /></i>
                        <span>{control.awayScore}</span>
                      </div>
                      <button type="button" className="mc-control-toggle" onClick={() => setShowControlMath((open) => !open)}>
                        {showControlMath ? "ซ่อนวิธีคำนวณ" : "คำนวณอย่างไร?"}
                      </button>
                      {showControlMath && (
                        <div className="mc-control-math">
                          <ul>
                            {control.inputs.map((input) => (
                              <li key={input.label}>
                                <span>{input.label}</span>
                                <b>{input.value} : {input.opponentValue}</b>
                                <em>น้ำหนัก {input.weight}%</em>
                              </li>
                            ))}
                          </ul>
                          {control.skipped.length > 0 && (
                            <p>ไม่ได้ใช้ในการคำนวณเพราะไม่มีข้อมูล: {control.skipped.join(" · ")}</p>
                          )}
                          <p className="mc-version">โมเดลเวอร์ชัน {control.version}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {moments.length > 0 && (
                    <div className="mc-moments">
                      <span className="eyebrow">จังหวะสำคัญ</span>
                      <ol>
                        {moments.map((moment) => (
                          <li key={`${moment.minute}-${moment.headline}`}>
                            <b>{moment.minute}&apos;</b>
                            <span><strong>{moment.headline}</strong><small>{moment.reason}</small></span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {tab === "lineups" && (
                <div className="mc-panel">
                  {bundle.capabilities.lineups ? (
                    <div className="mc-lineups">
                      {bundle.lineups.map((lineup) => (
                        <LineupPitch
                          key={lineup.teamId}
                          lineup={lineup}
                          teamName={lineup.teamId === bundle.fixture.home.id ? bundle.fixture.home.nameTh : bundle.fixture.away.nameTh}
                        />
                      ))}
                    </div>
                  ) : (
                    <Unavailable reason={UNAVAILABLE_REASON_TH.lineups} />
                  )}
                </div>
              )}

              {tab === "events" && (
                <div className="mc-panel">
                  {bundle.capabilities.events ? (
                    <ol className="mc-timeline">
                      {bundle.events.map((event) => (
                        <li key={event.id} className={event.teamId === bundle.fixture.home.id ? "home" : "away"}>
                          <b>{event.minute}&apos;{event.extraMinute ? `+${event.extraMinute}` : ""}</b>
                          <span className="mc-timeline-icon" aria-hidden="true">{EVENT_ICON[event.type]}</span>
                          <span>
                            <strong>{event.playerName || "—"}</strong>
                            <small>
                              {event.teamId === bundle.fixture.home.id ? bundle.fixture.home.shortName : bundle.fixture.away.shortName}
                              {event.relatedPlayerName ? ` · ${event.relatedPlayerName}` : ""}
                            </small>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Unavailable reason={UNAVAILABLE_REASON_TH.events} />
                  )}
                </div>
              )}

              {tab === "stats" && (
                <div className="mc-panel">
                  {bundle.capabilities.teamStats && homeStats && awayStats ? (
                    <div className="mc-stats">
                      <header>
                        <b>{bundle.fixture.home.shortName}</b>
                        <span>สถิติการแข่งขัน</span>
                        <b>{bundle.fixture.away.shortName}</b>
                      </header>
                      {(Object.keys(STAT_LABELS) as Array<keyof GOGTeamStats>).map((key) => (
                        <StatBar
                          key={key}
                          label={STAT_LABELS[key as string].th}
                          home={homeStats[key] as number | null}
                          away={awayStats[key] as number | null}
                        />
                      ))}
                    </div>
                  ) : (
                    <Unavailable reason={UNAVAILABLE_REASON_TH.teamStats} />
                  )}
                </div>
              )}

              {tab === "h2h" && (
                <div className="mc-panel">
                  {bundle.headToHead ? (
                    <div className="mc-h2h">
                      <div className="mc-h2h-summary">
                        <span><b>{bundle.headToHead.homeWins}</b>{bundle.fixture.home.shortName} ชนะ</span>
                        <span><b>{bundle.headToHead.draws}</b>เสมอ</span>
                        <span><b>{bundle.headToHead.awayWins}</b>{bundle.fixture.away.shortName} ชนะ</span>
                      </div>
                      {bundle.headToHead.recent.length > 0 ? (
                        <ul className="mc-h2h-list">
                          {bundle.headToHead.recent.map((row) => (
                            <li key={row.kickoffUtc}>
                              <span>{thaiShortDate(row.kickoffUtc)}</span>
                              <b>{row.homeName} {row.homeScore}–{row.awayScore} {row.awayName}</b>
                              <small>{row.competition}</small>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Unavailable reason="ผู้ให้บริการส่งสรุปสถิติมาแต่ไม่มีรายการนัดย้อนหลัง" />
                      )}
                    </div>
                  ) : (
                    <Unavailable reason={UNAVAILABLE_REASON_TH.headToHead} />
                  )}
                </div>
              )}

              {tab === "table" && (
                <div className="mc-panel">
                  {bundle.capabilities.standings ? (
                    <table className="mc-table">
                      <thead>
                        <tr><th>#</th><th>ทีม</th><th>แข่ง</th><th>ชนะ</th><th>เสมอ</th><th>แพ้</th><th>ผลต่าง</th><th>แต้ม</th></tr>
                      </thead>
                      <tbody>
                        {bundle.standings.map((row: GOGStanding) => {
                          const involved = row.teamId === bundle.fixture.home.id || row.teamId === bundle.fixture.away.id;
                          return (
                            <tr key={row.teamId} className={involved ? "involved" : ""}>
                              <td>{row.position}</td>
                              <td>{row.teamNameTh}</td>
                              <td>{row.played}</td>
                              <td>{row.won}</td>
                              <td>{row.drawn}</td>
                              <td>{row.lost}</td>
                              <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                              <td><b>{row.points}</b></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <Unavailable reason={UNAVAILABLE_REASON_TH.standings} />
                  )}
                </div>
              )}

              {tab === "venue" && (
                <div className="mc-panel">
                  {bundle.fixture.venue ? (
                    <>
                      <div className="mc-venue">
                        <h4>{bundle.fixture.venue.name}</h4>
                        <dl>
                          <div><dt>เมือง</dt><dd>{bundle.fixture.venue.city || "—"}</dd></div>
                          <div><dt>ประเทศ</dt><dd>{bundle.fixture.venue.country}</dd></div>
                          <div>
                            <dt>ความจุ</dt>
                            <dd>
                              {stadium
                                ? `${stadium.capacity.toLocaleString("th-TH")} ที่นั่ง`
                                : bundle.fixture.venue.capacity?.toLocaleString("th-TH") ?? "ยังไม่มีข้อมูลจากแหล่งที่เชื่อถือได้"}
                            </dd>
                          </div>
                          <div><dt>โซนเวลา</dt><dd>{bundle.fixture.venue.timezone}</dd></div>
                        </dl>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(`${bundle.fixture.venue.name} ${bundle.fixture.venue.city}`)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          เปิดแผนที่สนาม
                        </a>
                      </div>

                      {/* ── STEP 58 · คู่มือสนามที่ GOG เขียนเอง ─────────── */}
                      {stadium ? (
                        <div className="mc-guide">
                          <span className="eyebrow">GOG STADIUM GUIDE</span>
                          <h4>คู่มือสนามฉบับ GOG</h4>
                          <dl>
                            <div>
                              <dt>สนามบินที่ควรลง</dt>
                              <dd>{stadium.nearestAirports.join(" / ")}</dd>
                            </div>
                            <div><dt>สถานีที่ใกล้ที่สุด</dt><dd>{stadium.nearestStation}</dd></div>
                            <div><dt>เดินทางในเมือง</dt><dd>{stadium.localTransit}</dd></div>
                          </dl>
                          <div className="mc-guide-notes">
                            <p><b>วันแข่ง</b> {stadium.matchdayNotes}</p>
                            <p><b>วางแผนเดินทาง</b> {stadium.travelNotes}</p>
                          </div>
                          <p className="mc-note">
                            เนื้อหาส่วนนี้ทีมงาน GOG เขียนเอง แยกจากข้อมูลสถิติของผู้ให้บริการ
                            ความจุเป็นตัวเลขอ้างอิงเพื่อวางแผน ไม่ใช่จำนวนตั๋วที่ขายจริงในแต่ละนัด
                          </p>
                        </div>
                      ) : (
                        <Unavailable reason="ยังไม่มีคู่มือสนามฉบับ GOG ของสนามนี้ — ทีมงานกำลังทยอยเขียนเพิ่ม" />
                      )}
                    </>
                  ) : (
                    <Unavailable reason="ผู้ให้บริการยังไม่ระบุสนามของแมตช์นี้" />
                  )}
                </div>
              )}

              {tab === "travel" && travel && (
                <div className="mc-panel">
                  <div className="mc-travel">
                    <span className="eyebrow">PLAN THIS MATCH</span>
                    <h4>ไปดูเกมนี้ที่อังกฤษ</h4>
                    <p>
                      ส่งแมตช์นี้เข้าเครื่องมือวางแผนทริป — คำนวณตั๋วเครื่องบิน ที่พัก
                      แผนเที่ยวรายวัน วีซ่า และวันลาให้ทั้งชุด
                    </p>
                    <dl>
                      <div><dt>คู่</dt><dd>{bundle.fixture.home.nameTh} พบ {bundle.fixture.away.nameTh}</dd></div>
                      <div><dt>วันแข่ง</dt><dd>{thaiFullDate(bundle.fixture.kickoffUtc)}</dd></div>
                      <div><dt>เวลาไทย</dt><dd>{bundle.fixture.kickoffBangkok} น.</dd></div>
                      {bundle.fixture.venue && <div><dt>สนาม</dt><dd>{bundle.fixture.venue.name} · {bundle.fixture.venue.city}</dd></div>}
                    </dl>
                    <button type="button" className="mc-travel-cta" onClick={() => onPlanTrip?.(travel.tripFixtureKey)}>
                      <Plane size={14} aria-hidden="true" /> วางแผนไปดูเกมนี้
                    </button>
                    <p className="mc-note">ราคาทั้งหมดในเครื่องมือวางแผนเป็นการประมาณการ ยังไม่ได้เชื่อมระบบจองจริง</p>
                  </div>

                  {/* ── STEP 65 · เส้นทางวันแข่ง ─────────────────────────── */}
                  <div className="mc-route">
                    <span className="eyebrow">MATCHDAY ROUTE</span>
                    <ol className="mc-route-line">
                      <li><b>{travel.originCity}</b><small>{travel.originAirport}</small></li>
                      <li><b>{travel.recommendedAirports.join(" / ")}</b><small>สนามบินปลายทาง</small></li>
                      <li><b>{travel.baseCityTh}</b><small>เมืองฐาน · ที่พัก</small></li>
                      <li>
                        <b>{bundle.fixture.venue?.name ?? "สนามแข่ง"}</b>
                        <small>{travel.railDay && travel.railMinutes ? `นั่งรถไฟต่อ ${travel.railMinutes} นาที` : "อยู่ในเมืองฐาน"}</small>
                      </li>
                    </ol>
                    {travel.railDay && travel.railRoute && (
                      <p className="mc-note">สนามอยู่ที่{travel.venueCity} — วันแข่งเดินทาง {travel.railRoute} ไป-กลับ คิดค่ารถไฟให้ในแผนแล้ว</p>
                    )}
                  </div>

                  {/* ── STEP 63, 64 · ตารางราคาโดยประมาณ ─────────────────── */}
                  <div className="mc-estimates">
                    <header>
                      <span className="eyebrow">TRAVEL PREVIEW</span>
                      <b>ไปดูเกมนี้ด้วยตัวเอง ประมาณเท่าไหร่</b>
                      <small>ต่อคน คิดแบบพัก 2 คนต่อห้อง · รวมตั๋วเข้าสนามแล้ว</small>
                    </header>
                    <div className="mc-estimate-grid">
                      {travel.estimates.map((row) => (
                        <div className="mc-estimate-col" key={row.length}>
                          <span className="mc-estimate-length">{row.length} วัน</span>
                          {row.prices.map((price) => (
                            <span className="mc-estimate-row" key={price.budget}>
                              <em>{BUDGET_LABELS[price.budget as BudgetStyle].name}</em>
                              <b>ประมาณ {formatThb(price.perPerson)}</b>
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                    <p className="mc-note">
                      ราคาโดยประมาณเพื่อวางแผนเท่านั้น ยังไม่ได้เชื่อมระบบจองจริง —
                      ราคาจริงเปลี่ยนตามวันเดินทาง ที่ว่าง และเวลาที่จอง
                    </p>
                  </div>
                </div>
              )}

              {/* ── STEP 123 · DATA LAB — เปิดด้วย ?datalab=1 เท่านั้น ─────
                  มีไว้กันทีมออกแบบสร้างฟีเจอร์บนข้อมูลที่ยังไม่มีจริง
                  แสดงแค่ว่ามีข้อมูลอะไรบ้าง ไม่เปิดเผยคีย์หรือ payload ดิบ */}
              {dataLab && (
                <div className="mc-datalab">
                  <span className="eyebrow">DATA LAB · ตรวจความครอบคลุมข้อมูล</span>
                  <ul>
                    {(Object.keys(bundle.capabilities) as Array<keyof typeof bundle.capabilities>).map((key) => (
                      <li key={key} className={bundle.capabilities[key] ? "on" : "off"}>
                        <b>{bundle.capabilities[key] ? "✓" : "✕"}</b>
                        <span>{key}</span>
                        {!bundle.capabilities[key] && <em>{UNAVAILABLE_REASON_TH[key]}</em>}
                      </li>
                    ))}
                  </ul>
                  <dl>
                    <div><dt>ผู้ให้บริการ</dt><dd>{bundle.fixture.quality.source}</dd></div>
                    <div><dt>โหมดสาธิต</dt><dd>{bundle.demo ? "ใช่" : "ไม่"}</dd></div>
                    <div><dt>ข้อมูลดีเลย์</dt><dd>{bundle.fixture.quality.isDelayed ? "ใช่" : "ไม่"}</dd></div>
                    <div><dt>ซิงก์เหตุการณ์</dt><dd>{bundle.sync.events ?? "—"}</dd></div>
                    <div><dt>ซิงก์สถิติ</dt><dd>{bundle.sync.stats ?? "—"}</dd></div>
                    <div><dt>ซิงก์ไลน์อัพ</dt><dd>{bundle.sync.lineups ?? "—"}</dd></div>
                  </dl>
                </div>
              )}

              <p className="mc-sync">
                <Clock size={11} aria-hidden="true" />
                {bundle.demo
                  ? "ข้อมูลตัวอย่างสำหรับทดสอบระบบ — ยังไม่ได้เชื่อมผู้ให้บริการข้อมูลจริง"
                  : `อัปเดตล่าสุด ${bundle.sync.fixture ? new Date(bundle.sync.fixture).toLocaleString("th-TH") : "—"} · ข้อมูลจากฟีดฟรีอาจมีความล่าช้า`}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
