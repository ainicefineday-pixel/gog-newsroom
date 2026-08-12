"use client";
/* eslint-disable react-hooks/refs, @next/next/no-html-link-for-pages, @typescript-eslint/no-unused-expressions */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Expand,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { MATCHES, MATCH_BY_ID } from "./data";
import {
  chartSeries,
  liveStats,
  positionsAt,
  reconstructMatch,
  stateAt,
} from "./engine";
import type { DataStatus, GeneratedMatch, MatchEvent, Team } from "./types";
import { eventCopy, ui, type ReplayLanguage } from "./i18n";
import { RainbowButton } from "@/registry/magicui/rainbow-button";
import { ShinyButton } from "@/registry/magicui/shiny-button";
import { WavyBackground } from "@/components/ui/wavy-background";

const STATUS: Record<DataStatus, string> = {
  confirmed: "CONFIRMED",
  reconstructed: "RECONSTRUCTED",
  estimated: "ESTIMATED",
};
const timeOf = (event: MatchEvent) => event.minute * 60 + event.second;
const formatClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const eventClock = (event: MatchEvent) =>
  `${String(event.minute).padStart(2, "0")}:${String(event.second).padStart(2, "0")}`;
const allPlayers = (team: Team) => [...team.starters, ...team.substitutes];

function StatusChip({
  status,
  lang = "en",
}: {
  status: DataStatus;
  lang?: ReplayLanguage;
}) {
  const thai = {
    confirmed: "ยืนยันแล้ว",
    reconstructed: "จำลองขึ้นใหม่",
    estimated: "ค่าประมาณ",
  };
  return (
    <span className={`replay-status ${status}`}>
      {lang === "th" ? thai[status] : STATUS[status]}
    </span>
  );
}

function LanguageToggle({
  lang,
  onChange,
}: {
  lang: ReplayLanguage;
  onChange: (lang: ReplayLanguage) => void;
}) {
  return (
    <div className="language-toggle" role="group" aria-label="Language">
      <button
        className={lang === "th" ? "active" : ""}
        onClick={() => onChange("th")}
      >
        ไทย
      </button>
      <button
        className={lang === "en" ? "active" : ""}
        onClick={() => onChange("en")}
      >
        EN
      </button>
    </div>
  );
}

export function ReplayLibrary() {
  const [lang, setLang] = useState<ReplayLanguage>("th"),
    copy = ui[lang];
  return (
    <main className="replay-site replay-library" lang={lang}>
      <WavyBackground containerClassName="replay-hero-wave">
        <header className="replay-library-head">
          <div className="replay-head-row">
            <a href="/" className="replay-back">
              <ArrowLeft size={16} /> {copy.newsroom}
            </a>
            <LanguageToggle lang={lang} onChange={setLang} />
          </div>
          <span>{copy.lab}</span>
          <h1>
            {copy.hero}
            <br />
            <em>{copy.heroEm}</em>
          </h1>
          <p>{copy.intro}</p>
          <ShinyButton
            onClick={() =>
              document
                .querySelector(".replay-cards")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            {lang === "th" ? "เลือกแมตช์ที่จะดู" : "CHOOSE A MATCH"}
          </ShinyButton>
        </header>
      </WavyBackground>
      <section className="replay-cards">
        {MATCHES.map((match, index) => (
          <article className="replay-card" key={match.id}>
            <div className={`replay-thumb replay-thumb-${index}`}>
              <div className="mini-pitch">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span>{match.competition}</span>
            </div>
            <div className="replay-card-body">
              <time>
                {new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
                  dateStyle: "long",
                }).format(new Date(match.date + "T12:00:00Z"))}
              </time>
              <h2>
                {match.home.name}
                <b>
                  {match.finalScore[0]}–{match.finalScore[1]}
                </b>
                {match.away.name}
              </h2>
              <p>{match.venue}</p>
              <div className="coverage">
                <StatusChip status="confirmed" lang={lang} />
                <span>
                  {lang === "th"
                    ? "ครอบคลุมผลการแข่งขัน เหตุการณ์สำคัญ รายชื่อ และสถิติรวมที่เผยแพร่"
                    : match.coverage}
                </span>
              </div>
              <RainbowButton
                onClick={() => (location.href = `/match/${match.id}`)}
              >
                {copy.open} <ChevronRight size={16} />
              </RainbowButton>
            </div>
          </article>
        ))}
      </section>
      <DataNotice lang={lang} />
      <footer>
        <a href="/about-data">{copy.method}</a>
        <span>{copy.seeded}</span>
      </footer>
    </main>
  );
}

function DataNotice({ lang = "en" }: { lang?: ReplayLanguage }) {
  const copy = ui[lang];
  return (
    <aside className="data-notice">
      <BarChart3 size={24} />
      <div>
        <b>{copy.notice}</b>
        <p>{copy.noticeBody}</p>
      </div>
    </aside>
  );
}

function Pitch({
  match,
  time,
  labels,
  trails,
  zones,
}: {
  match: GeneratedMatch;
  time: number;
  labels: boolean;
  trails: boolean;
  zones: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let raf = 0;
    const draw = () => {
      const rect = canvas.getBoundingClientRect(),
        dpr = window.devicePixelRatio || 1;
      if (
        canvas.width !== Math.floor(rect.width * dpr) ||
        canvas.height !== Math.floor(rect.height * dpr)
      ) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width,
        h = rect.height,
        pad = 16,
        pw = w - pad * 2,
        ph = h - pad * 2,
        x = (px: number) => pad + (px / 105) * pw,
        y = (py: number) => pad + (py / 68) * ph;
      context.fillStyle = "#0b5a36";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#126b40";
      for (let i = 0; i < 10; i += 2)
        context.fillRect(pad + (i * pw) / 10, pad, pw / 10, ph);
      context.strokeStyle = "rgba(255,255,255,.72)";
      context.lineWidth = 1.5;
      context.strokeRect(pad, pad, pw, ph);
      context.beginPath();
      context.moveTo(x(52.5), y(0));
      context.lineTo(x(52.5), y(68));
      context.stroke();
      context.beginPath();
      context.arc(x(52.5), y(34), ph * 0.135, 0, Math.PI * 2);
      context.stroke();
      for (const side of [0, 1]) {
        const sx = side ? x(105) : x(0),
          dir = side ? -1 : 1;
        context.strokeRect(sx, y(13.84), dir * 16.5, y(54.16) - y(13.84));
        context.strokeRect(sx, y(24.84), dir * 5.5, y(43.16) - y(24.84));
      }
      if (zones) {
        context.fillStyle = "rgba(246,211,45,.07)";
        context.fillRect(x(35), pad, x(70) - x(35), ph);
        context.fillStyle = "rgba(227,27,35,.08)";
        context.fillRect(x(70), pad, x(105) - x(70), ph);
      }
      const frame = positionsAt(match, timeRef.current),
        state = stateAt(match, timeRef.current);
      for (const [teamIndex, team] of [
        match.definition.home,
        match.definition.away,
      ].entries()) {
        for (const playerId of state.active[team.id]) {
          const pos = frame.players[playerId];
          if (!pos) continue;
          const player = allPlayers(team).find((p) => p.id === playerId)!;
          if (trails) {
            context.strokeStyle = team.color + "66";
            context.beginPath();
            context.moveTo(x(pos.x - 3), y(pos.y));
            context.lineTo(x(pos.x), y(pos.y));
            context.stroke();
          }
          context.fillStyle = teamIndex ? team.color : team.color;
          context.strokeStyle = team.secondary;
          context.lineWidth = 2;
          context.beginPath();
          context.arc(x(pos.x), y(pos.y), 9, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          context.fillStyle =
            teamIndex && team.color === "#f5f5f0" ? "#07131f" : "white";
          context.font = "700 8px system-ui";
          context.textAlign = "center";
          context.fillText(
            String(player.number ?? player.shortName.slice(0, 2).toUpperCase()),
            x(pos.x),
            y(pos.y) + 3,
          );
          if (labels) {
            context.fillStyle = "rgba(4,10,18,.86)";
            context.fillRect(x(pos.x) - 25, y(pos.y) + 12, 50, 13);
            context.fillStyle = "white";
            context.font = "600 8px system-ui";
            context.fillText(
              player.shortName.slice(0, 10),
              x(pos.x),
              y(pos.y) + 21,
            );
          }
          if (state.cards[playerId]) {
            context.fillStyle =
              state.cards[playerId] === "red" ? "#ff3344" : "#ffd52a";
            context.fillRect(x(pos.x) + 7, y(pos.y) - 11, 5, 7);
          }
        }
      }
      context.fillStyle = "#fff";
      context.shadowColor = "#000";
      context.shadowBlur = 5;
      context.beginPath();
      context.arc(x(frame.ball.x), y(frame.ball.y), 4.5, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [match, labels, trails, zones]);
  return (
    <canvas
      ref={canvasRef}
      className="replay-canvas"
      aria-label="Top-down reconstructed football pitch"
    />
  );
}

function Lineup({
  team,
  match,
  time,
}: {
  team: Team;
  match: GeneratedMatch;
  time: number;
}) {
  const state = stateAt(match, time),
    active = new Set(state.active[team.id]);
  return (
    <aside className="replay-lineup">
      <header>
        <span style={{ background: team.color }}>
          {team.shortName.slice(0, 3).toUpperCase()}
        </span>
        <div>
          <b>{team.name}</b>
          <small>{team.formation}</small>
        </div>
      </header>
      <ul>
        {allPlayers(team).map((player) => (
          <li
            key={player.id}
            className={active.has(player.id) ? "active" : "inactive"}
          >
            <i>{player.number ?? "·"}</i>
            <span>
              {player.name}
              <small>
                {player.position}
                {player.captain ? " · C" : ""}
              </small>
            </span>
            {state.cards[player.id] && (
              <em className={state.cards[player.id]} />
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function XgChart({ match, time }: { match: GeneratedMatch; time: number }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    series = useMemo(() => chartSeries(match), [match]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const c = el.getContext("2d")!,
      rect = el.getBoundingClientRect(),
      dpr = devicePixelRatio || 1;
    el.width = rect.width * dpr;
    el.height = rect.height * dpr;
    c.scale(dpr, dpr);
    const w = rect.width,
      h = rect.height,
      max = Math.max(...series.flatMap((p) => [p.home, p.away]), 1);
    c.strokeStyle = "#27394a";
    c.beginPath();
    c.moveTo(28, 10);
    c.lineTo(28, h - 22);
    c.lineTo(w - 8, h - 22);
    c.stroke();
    [match.definition.home.color, match.definition.away.color].forEach(
      (color, idx) => {
        c.strokeStyle = color;
        c.lineWidth = 2.5;
        c.beginPath();
        series
          .filter((p) => p.minute <= time / 60)
          .forEach((p, i) => {
            const px = 28 + (p.minute / 90) * (w - 38),
              py = h - 22 - ((idx ? p.away : p.home) / max) * (h - 38);
            i ? c.lineTo(px, py) : c.moveTo(px, py);
          });
        c.stroke();
      },
    );
  }, [match, series, time]);
  return (
    <canvas
      ref={canvas}
      className="analytics-canvas"
      aria-label="Cumulative expected goals chart"
    />
  );
}

export function ReplayMatch({ matchId }: { matchId: string }) {
  const definition = MATCH_BY_ID[matchId];
  const match = useMemo(
    () => (definition ? reconstructMatch(definition) : null),
    [definition],
  );
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [labels, setLabels] = useState(true),
    [trails, setTrails] = useState(false),
    [zones, setZones] = useState(false),
    [filter, setFilter] = useState("all"),
    [tab, setTab] = useState("timeline"),
    [lang, setLang] = useState<ReplayLanguage>("th");
  const copy = ui[lang],
    last = useRef(0),
    timeRef = useRef(0);
  timeRef.current = time;
  useEffect(() => {
    if (!playing || !match) return;
    let raf = 0;
    const loop = (stamp: number) => {
      if (!last.current) last.current = stamp;
      const next = Math.min(
        match.duration,
        timeRef.current + ((stamp - last.current) / 1000) * speed,
      );
      last.current = stamp;
      timeRef.current = next;
      setTime(next);
      if (next >= match.duration) {
        setPlaying(false);
        last.current = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      last.current = 0;
    };
  }, [playing, speed, match]);
  const seek = useCallback(
    (value: number) => {
      if (!match) return;
      const next = Math.max(0, Math.min(match.duration, value));
      timeRef.current = next;
      setTime(next);
    },
    [match],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((v) => !v);
      }
      if (event.key === "ArrowLeft") seek(timeRef.current - 10);
      if (event.key === "ArrowRight") seek(timeRef.current + 10);
      if (event.key === "0") seek(0);
      if (["1", "2", "5"].includes(event.key)) setSpeed(Number(event.key));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [seek]);
  if (!match)
    return (
      <main className="replay-site">
        <h1>Match not found</h1>
        <a href="/replay">Return to match library</a>
      </main>
    );
  const state = stateAt(match, time),
    stats = liveStats(match, time),
    events = match.events.filter((event) =>
      filter === "all" || filter === "confirmed"
        ? filter !== "confirmed" || event.dataStatus === "confirmed"
        : event.type === filter,
    ),
    currentIndex = match.events.findLastIndex((event) => timeOf(event) <= time),
    current = state.currentEvent;
  const liveFeed = match.events
    .filter((event) => timeOf(event) <= time)
    .slice(-6)
    .reverse();
  const jump = (dir: number) => {
    const target =
      match.events[
        Math.max(0, Math.min(match.events.length - 1, currentIndex + dir))
      ];
    seek(timeOf(target));
  };
  return (
    <main className="replay-site replay-match" lang={lang}>
      <header className="replay-top">
        <a href="/replay">
          <ArrowLeft size={15} /> {copy.library}
        </a>
        <div>
          <span>{match.definition.competition}</span>
          <b>
            {match.definition.home.shortName}{" "}
            <em>
              {state.score[0]} – {state.score[1]}
            </em>{" "}
            {match.definition.away.shortName}
          </b>
          <small>{match.definition.venue}</small>
        </div>
        <div className="match-clock" aria-live="polite">
          <div className="clock-readout">
            <strong>{formatClock(time)}</strong>
            <small>{lang === "th" ? "นาที : วินาที" : "MIN : SEC"}</small>
          </div>
          <StatusChip status={current.dataStatus} lang={lang} />
          <LanguageToggle lang={lang} onChange={setLang} />
        </div>
      </header>
      <DataNotice lang={lang} />
      <section className="replay-stage">
        <Lineup team={match.definition.home} match={match} time={time} />
        <div className="pitch-column">
          <div className="pitch-wrap">
            <Pitch
              match={match}
              time={time}
              labels={labels}
              trails={trails}
              zones={zones}
            />
            <button
              className="fullscreen-button"
              onClick={() =>
                document.querySelector(".pitch-wrap")?.requestFullscreen()
              }
              aria-label="Fullscreen pitch"
            >
              <Expand size={16} />
            </button>
            <div className="current-event">
              <StatusChip status={current.dataStatus} lang={lang} />
              <span>
                <b>{eventClock(current)}</b>
                {eventCopy(current, lang)}
              </span>
            </div>
          </div>
          <aside className="replay-news-feed" aria-live="polite">
            <header>
              <div>
                <span className="live-dot" />
                <b>{lang === "th" ? "ฟีดข่าวประกบเกม" : "MATCH NEWS FEED"}</b>
              </div>
              <small>
                {lang === "th"
                  ? "เรียงตามนาฬิการีเพลย์"
                  : "Synced to the replay clock"}
              </small>
            </header>
            <div className="replay-feed-list">
              {liveFeed.map((event, index) => {
                const source =
                  event.dataStatus === "confirmed"
                    ? match.definition.sources[
                        Math.abs(event.minute) % match.definition.sources.length
                      ]
                    : null;
                return (
                  <button
                    key={event.id}
                    className={index === 0 ? "active" : ""}
                    onClick={() => seek(timeOf(event))}
                  >
                    <time>{eventClock(event)}</time>
                    <span>
                      <strong>{eventCopy(event, lang)}</strong>
                      <small>
                        {source
                          ? `${lang === "th" ? "อ้างอิง" : "Source"}: ${source.label}`
                          : lang === "th"
                            ? "GOG Replay · เหตุการณ์จำลอง"
                            : "GOG Replay · reconstructed event"}
                      </small>
                    </span>
                    <StatusChip status={event.dataStatus} lang={lang} />
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="replay-controls">
            <button onClick={() => seek(0)} aria-label="Restart">
              <RotateCcw />
            </button>
            <button onClick={() => jump(-1)} aria-label="Previous event">
              <SkipBack />
            </button>
            <RainbowButton
              className="play"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? copy.pause : copy.play}
            >
              {playing ? <Pause /> : <Play />}
            </RainbowButton>
            <button onClick={() => jump(1)} aria-label="Next event">
              <SkipForward />
            </button>
            <button
              onClick={() => seek(time + 10)}
              aria-label="Forward ten seconds"
            >
              <ChevronRight />
            </button>
            <input
              aria-label="Replay seek bar"
              type="range"
              min="0"
              max={match.duration}
              step="1"
              value={time}
              onChange={(event) => seek(Number(event.target.value))}
            />
            <select
              aria-label="Replay speed"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              {[0.5, 1, 2, 5, 10, 30].map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </div>
          <div className="overlay-controls">
            <button
              className={labels ? "on" : ""}
              onClick={() => setLabels((v) => !v)}
            >
              {copy.labels}
            </button>
            <button
              className={trails ? "on" : ""}
              onClick={() => setTrails((v) => !v)}
            >
              {copy.trails}
            </button>
            <button
              className={zones ? "on" : ""}
              onClick={() => setZones((v) => !v)}
            >
              {copy.zones}
            </button>
            <ShinyButton onClick={() => seek(45 * 60)}>{copy.second}</ShinyButton>
          </div>
        </div>
        <Lineup team={match.definition.away} match={match} time={time} />
      </section>
      <section className="replay-bottom">
        <nav>
          {[
            ["timeline", copy.timeline],
            ["stats", copy.stats],
            ["analytics", copy.analytics],
            ["report", copy.report],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "timeline" && (
          <div className="timeline-panel">
            <div className="event-filters">
              {[
                ["all", copy.all],
                ["goal", copy.goals],
                ["shot", copy.shots],
                ["yellow-card", copy.cards],
                ["substitution", copy.subs],
                ["confirmed", copy.confirmed],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="minute-list">
              {match.minuteReports.filter(report=>filter==="all"||report.eventIds.some(id=>events.some(event=>event.id===id))).map((report) => (
                <button
                  key={report.minute}
                  className={
                    Math.floor(time / 60) === report.minute ? "active" : ""
                  }
                  onClick={() => seek(report.minute * 60)}
                >
                  <b>{report.displayMinute}</b>
                  <StatusChip status={report.dataStatus} lang={lang} />
                  <span>{eventCopy(match.events.find(event=>report.eventIds.includes(event.id))??match.events[0],lang)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "stats" && <StatsPanel match={match} stats={stats} />}{" "}
        {tab === "analytics" && <AnalyticsPanel match={match} time={time} />}{" "}
        {tab === "report" && (
          <PostMatch match={match} onReplay={() => seek(0)} lang={lang} />
        )}
      </section>
    </main>
  );
}

function StatsPanel({
  match,
  stats,
}: {
  match: GeneratedMatch;
  stats: ReturnType<typeof liveStats>;
}) {
  const home = match.definition.home.id,
    away = match.definition.away.id;
  const rows = [
    "shots",
    "onTarget",
    "corners",
    "fouls",
    "yellow",
    "red",
    "xg",
  ] as const;
  return (
    <div className="stat-grid">
      {rows.map((key) => (
        <div key={key}>
          <b>{key === "onTarget" ? "Shots on target" : key.toUpperCase()}</b>
          <strong>
            {key === "xg" ? stats[home][key].toFixed(2) : stats[home][key]}
          </strong>
          <i>
            <span
              style={{
                width: `${(stats[home][key] / Math.max(1, stats[home][key] + stats[away][key])) * 100}%`,
              }}
            />
          </i>
          <strong>
            {key === "xg" ? stats[away][key].toFixed(2) : stats[away][key]}
          </strong>
          {["xg"].includes(key) && (
            <StatusChip
              status={
                match.definition.statistics.xg ? "confirmed" : "estimated"
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
function AnalyticsPanel({
  match,
  time,
}: {
  match: GeneratedMatch;
  time: number;
}) {
  return (
    <div className="analytics-grid">
      <article>
        <header>
          <b>Cumulative xG</b>
          <StatusChip
            status={match.definition.statistics.xg ? "confirmed" : "estimated"}
          />
        </header>
        <XgChart match={match} time={time} />
        <small>
          Event locations between published anchors are reconstructed.
        </small>
      </article>
      <article>
        <header>
          <b>Passing network</b>
          <StatusChip status="reconstructed" />
        </header>
        <div className="network-viz">
          {match.definition.home.starters.slice(0, 8).map((p, i) => (
            <i
              key={p.id}
              style={{
                left: `${10 + (i % 4) * 26}%`,
                top: `${20 + Math.floor(i / 4) * 48}%`,
              }}
              title={p.name}
            />
          ))}
        </div>
        <small>Derived from the same reconstructed possession events.</small>
      </article>
      <article>
        <header>
          <b>Player heatmap</b>
          <StatusChip status="reconstructed" />
        </header>
        <div className="heatmap-viz">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <small>
          Sampled from interpolated positions—not official tracking data.
        </small>
      </article>
      <article>
        <header>
          <b>Confirmed / reconstructed</b>
        </header>
        <div className="coverage-bars">
          <b
            style={{
              width: `${(match.events.filter((e) => e.dataStatus === "confirmed").length / match.events.length) * 100}%`,
            }}
          >
            Confirmed
          </b>
          <b>Reconstructed</b>
        </div>
        <p>
          {match.events.filter((e) => e.dataStatus === "confirmed").length}{" "}
          confirmed anchors ·{" "}
          {match.events.filter((e) => e.dataStatus !== "confirmed").length}{" "}
          supporting actions
        </p>
      </article>
    </div>
  );
}
function PostMatch({
  match,
  onReplay,
  lang,
}: {
  match: GeneratedMatch;
  onReplay: () => void;
  lang: ReplayLanguage;
}) {
  const copy=ui[lang];
  const goals = match.events.filter((e) => e.type === "goal");
  return (
    <div className="post-match">
      <span>{lang==="th"?"รายงานหลังจบเกม":"FULL-TIME REPORT"}</span>
      <h2>
        {match.definition.home.name}{" "}
        <b>
          {match.definition.finalScore[0]}–{match.definition.finalScore[1]}
        </b>{" "}
        {match.definition.away.name}
      </h2>
      <p>
        {lang==="th"?"ผลการแข่งขันและเหตุการณ์สำคัญยึดตามข้อมูลที่ยืนยันได้ ส่วนข้อสังเกตทางแท็กติกและการวิเคราะห์พื้นที่คำนวณจากรีเพลย์จำลอง":"The confirmed result and major incidents are preserved. Tactical observations, ratings and spatial analysis are reconstruction-based."}
      </p>
      <div>
        {goals.map((goal) => (
          <article key={goal.id}>
            <StatusChip status="confirmed" lang={lang} />
            <b>
              {goal.displayMinute} {eventCopy(goal,lang)}
            </b>
          </article>
        ))}
      </div>
      <section>
        <h3>{lang==="th"?"จุดเปลี่ยนทางแท็กติก":"Key tactical observation"}</h3>
        <p>
          {lang==="th"?(match.definition.id.includes("leeds")?"หลังใบแดงนาที 56 ยูไนเต็ดหดรูปเป็น 4-4-1 ด้วยผู้เล่นสิบคน ลีดส์จึงครองพื้นที่แดนบนมากขึ้น แต่เจ้าบ้านยังอันตรายจากลูกนิ่งและได้ประตูจากลูกโหม่งของกาเซมิโร":"เปแอสเชครองบอลมากกว่า ขณะที่ยูไนเต็ดสร้างปริมาณการยิงได้มากและโจมตีตรงผ่านอาหมัดกับเอ็มเบอโม่ ครึ่งหลังจังหวะเกมขาดตอนจากการเปลี่ยนตัวหลายครั้ง"):match.definition.id.includes("leeds")?"After the 56th-minute dismissal, United contract into a ten-player 4-4-1 while Leeds gain territorial control. United still threaten through set plays, culminating in Casemiro's goal.":"PSG control more possession, while United generate the larger shot volume and attack directly through Amad and Mbeumo. The second half becomes fragmented by changes."}
        </p>
      </section>
      <footer>
        <RainbowButton onClick={onReplay}><Play size={15} /> {copy.replay}</RainbowButton>
        <a href="/replay">{copy.another}</a>
        <code>Seed {match.definition.seed}</code>
      </footer>
    </div>
  );
}

export function AboutReplayData() {
  const [lang,setLang]=useState<ReplayLanguage>("th");
  return (
    <main className="replay-site methodology" lang={lang}>
      <div className="replay-head-row"><a href="/replay" className="replay-back"><ArrowLeft size={16} /> {ui[lang].library}</a><LanguageToggle lang={lang} onChange={setLang}/></div>
      <span>{lang==="th"?"วิธีจัดการและอธิบายข้อมูล":"DATA METHODOLOGY"}</span>
      <h1>
        {lang==="th"?"อะไรคือข้อเท็จจริง":"What is known."}
        <br />
        <em>{lang==="th"?"อะไรคือภาพจำลอง":"What is reconstructed."}</em>
      </h1>
      <DataNotice lang={lang} />
      <section>
        <h2>{lang==="th"?"ข้อมูลที่ยืนยันแล้ว":"Confirmed data"}</h2>
        <p>{lang==="th"?"ผลการแข่งขัน รายชื่อ เหตุการณ์สำคัญ การเปลี่ยนตัวที่ทราบ และสถิติรวมที่เผยแพร่ ถูกเก็บไว้ในโปรเจกต์และเครื่องมือจำลองไม่มีสิทธิ์เปลี่ยนค่าเหล่านี้":"Final scores, supplied lineups, published major events, known substitutions and aggregate statistics are stored locally and never changed by the generator."}</p>
        <h2>{lang==="th"?"ข้อมูลที่สร้างขึ้นใหม่":"Reconstructed data"}</h2>
        <p>{lang==="th"?"สองแมตช์นี้ไม่มีชุดข้อมูล Tracking ต่อเนื่องอย่างเป็นทางการ พิกัดผู้เล่น วิถีบอล การจ่าย การพาบอล การขยับรูปทีม Heatmap, Pass Network และ xG ที่ไม่มีแหล่งเผยแพร่ จึงเป็นการจำลองเพื่อช่วยมองภาพเกม":"No continuous official tracking dataset was available for these fixtures. Movement, event coordinates, ordinary actions, heatmaps, pass networks and unsourced xG values are simulations."}</p>
        <h2>{lang==="th"?"ทำไมเปิดซ้ำแล้วเหมือนเดิม":"Deterministic engine"}</h2>
        <p>{lang==="th"?"แต่ละแมตช์มี Seed คงที่ จึงได้เหตุการณ์ พิกัด รายงานรายนาที และกราฟเหมือนเดิมทุกครั้ง ข้อมูลที่ยืนยันแล้วจะไม่เปลี่ยนแม้เปลี่ยน Seed":"Each match has a fixed seed. The same seed produces the same actions, coordinates, minute reports and charts. Confirmed anchors remain fixed regardless of seed."}</p>
      </section>
      {MATCHES.map((match) => (
        <section key={match.id}>
          <h2>
            {match.home.shortName} vs {match.away.shortName}
          </h2>
          <ul>
            {match.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
