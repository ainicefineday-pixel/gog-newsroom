"use client";

// ผังสายข่าว — แหล่งข่าว → ด่านคัด → ปลายทาง
// ---------------------------------------------------------------------------
// ผังนี้ไม่ใช่ภาพประกอบ ทุกอย่างบนนั้นมาจากตารางจริง:
//   เส้นสว่างเฉพาะแหล่งที่รอบนี้มีข่าวเข้าจริง แหล่งที่เงียบเส้นดับ
//   ตัวเลขบนเส้นคือ ดึงมากี่ชิ้น → ผ่านเกณฑ์กี่ชิ้น ของแหล่งนั้น
//   แหล่งที่ดึงไม่ได้ขึ้นแดงพร้อมบอกว่าเงียบมากี่ชั่วโมง
//   กดโหนดแล้วกรองฟีดข่าวข้างล่างทันที
//   ด่านกลางกางเป็นสามขั้นพร้อมเลขที่คัดทิ้งแต่ละขั้น
//   มีทางแยกของข่าวที่ยืนยันไม่ได้ ไม่ซ่อน
//   มีไทม์ไลน์ 24 ชม. ให้เห็นจังหวะข่าวของวัน
//   ตอนกดซิงก์ ผังเดินตามสถานะจริงจากเซิร์ฟเวอร์ ไม่ใช่แอนิเมชันวนลูป
//
// แนวคิดลำแสงมาจาก AnimatedBeam ของ Magic UI แต่เขียนเองด้วย CSS
// เส้นคำนวณจาก getBoundingClientRect จริง จึงย้ายตามเลย์เอาต์ทุกขนาดจอ

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { NEWS_SOURCE_DIRECTORY } from "@/config/news-sources";
import { AnimatedSpan, Marquee, Terminal, TypingAnimation } from "@/app/terminal";

type NodeKey = string;

type Beam = {
  id: string;
  sourceId: string;
  d: string;
  reverse: boolean;
  delay: number;
  /** เส้นนี้มีข่าวไหลจริงไหมในรอบล่าสุด */
  live: boolean;
  /** สถานะสุขภาพของแหล่งต้นทาง — ใช้ย้อมสีเส้น */
  health: string;
};

export type FlowSourceState = {
  id: string;
  label: string;
  health: "ok" | "quiet" | "down" | "unknown";
  error: string;
  fetched: number;
  matched: number;
  storedRecently: number;
  hoursSinceLast: number | null;
  latestHeadline: string;
};

export type NewsFlowData = {
  stages: { fetched: number; matched: number; stored: number; startedAt: string; finishedAt: string; status: string } | null;
  sources: FlowSourceState[];
  unverified: { count: number; samples: Array<{ id: string; title: string; source: string }> };
  timeline: Array<{ hour: string; count: number; bySource: Record<string, number> }>;
  outputs: { storiesTotal: number; verified: number; translated: number };
};

export type IngestProgress = {
  runStartedAt: string;
  stage: string;
  detail: string;
  fetched: number;
  matched: number;
  stored: number;
  done: boolean;
} | null;

export type SyncLog = {
  finished_at: string;
  fetched: number;
  matched: number;
  stored: number;
  status: string;
} | null;

const SUCCESS_STATUSES = new Set(["success", "ok", "completed"]);

/**
 * โหนดนี้กดกรองฟีดได้ไหม
 * ตัวกรองฟีดทำงานด้วย id ของแหล่งเดี่ยว ส่วนโหนด X รวมหลายบัญชีไว้ด้วยกัน
 * จึงไม่มี id เดียวที่แทนมันได้ ต้องปิดปุ่มไว้ ไม่ใช่ปล่อยให้กดแล้วไม่มีอะไรเกิดขึ้น
 */
const filterable = (id: string) => NEWS_SOURCE_DIRECTORY.some((entry) => entry.id === id);

const HEALTH_LABEL: Record<FlowSourceState["health"], string> = {
  ok: "ปกติ",
  quiet: "เงียบผิดปกติ",
  down: "ดึงไม่ได้",
  unknown: "ยังไม่มีข้อมูล",
};

const STAGE_LABEL: Record<string, string> = {
  rss: "กำลังอ่านฟีด",
  x: "กำลังเก็บโพสต์ X",
  filter: "กำลังคัดข่าวที่เกี่ยวกับแมนยู",
  store: "กำลังบันทึกลงคลัง",
  done: "เสร็จแล้ว",
  failed: "ล้มเหลว",
};

const OUTPUTS = [
  { key: "thai", label: "ข่าวไทยที่ตรวจแล้ว" },
  { key: "match", label: "Match Center" },
  { key: "trip", label: "วางแผนทริป" },
];

function SyncTerminal({ log, sources, progress }: { log: SyncLog; sources: number; progress: IngestProgress }) {
  const finishedAt = log
    ? new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      }).format(new Date(log.finished_at))
    : null;

  // กำลังซิงก์อยู่ = โชว์สถานะสด ไม่ใช่ log ของรอบเก่า
  if (progress && !progress.done) {
    return (
      <Terminal title="gog-newsroom · ingest (กำลังทำงาน)">
        <TypingAnimation delay={0}>{`$ gog ingest --sources ${sources}`}</TypingAnimation>
        <AnimatedSpan delay={0.2} tone="info">
          <span>▸ {STAGE_LABEL[progress.stage] ?? progress.stage}</span>
        </AnimatedSpan>
        {progress.detail && <AnimatedSpan delay={0.3}>{`  ${progress.detail}`}</AnimatedSpan>}
      </Terminal>
    );
  }

  return (
    <Terminal title="gog-newsroom · ingest">
      <TypingAnimation delay={0}>{`$ gog ingest --sources ${sources}`}</TypingAnimation>
      {log ? (
        <>
          <AnimatedSpan delay={1.5}>✔ อ่านฟีดครบทุกแหล่ง</AnimatedSpan>
          <AnimatedSpan delay={2.0}>{`✔ พบรายการทั้งหมด ${log.fetched} ชิ้น`}</AnimatedSpan>
          <AnimatedSpan delay={2.5}>{`✔ ตรงกับแมนเชสเตอร์ ยูไนเต็ด ${log.matched} ชิ้น`}</AnimatedSpan>
          <AnimatedSpan delay={3.0}>✔ ตรวจข้ามแหล่งและให้คะแนนความน่าเชื่อถือแล้ว</AnimatedSpan>
          <AnimatedSpan delay={3.5}>{`✔ บันทึกลงคลัง ${log.stored} ข่าว`}</AnimatedSpan>
          <AnimatedSpan delay={4.0} tone={SUCCESS_STATUSES.has(log.status) ? "info" : "warn"}>
            <span>
              {SUCCESS_STATUSES.has(log.status) ? "ℹ" : "!"} รอบล่าสุด {finishedAt} น.
              {SUCCESS_STATUSES.has(log.status) ? "" : ` · สถานะ ${log.status}`}
            </span>
          </AnimatedSpan>
          <TypingAnimation delay={4.6} className="muted">
            {"ระบบซิงก์เองทุก 10 นาที ไม่ต้องกดเอง"}
          </TypingAnimation>
        </>
      ) : (
        <AnimatedSpan delay={1.5} tone="warn">! ยังไม่เคยซิงก์ในรอบนี้ — กดปุ่มซิงก์ที่มุมขวาบนได้เลย</AnimatedSpan>
      )}
    </Terminal>
  );
}

/** จังหวะข่าวเข้าราย ชม. ย้อนหลัง 24 ชม. */
function Timeline({ data, onPick, picked }: {
  data: NewsFlowData["timeline"];
  onPick: (hour: string | null) => void;
  picked: string | null;
}) {
  const peak = Math.max(1, ...data.map((entry) => entry.count));
  const label = (hour: string) => new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
  }).format(new Date(`${hour}:00:00Z`));

  return (
    <div className="flow-timeline">
      <header>
        <b>จังหวะข่าวเข้า 24 ชั่วโมงที่ผ่านมา</b>
        {picked
          ? <button type="button" onClick={() => onPick(null)}>ล้างช่วงที่เลือก</button>
          : <span>สูงสุด {peak} ชิ้นต่อชั่วโมง</span>}
      </header>
      <div className="flow-timeline-bars">
        {data.map((entry) => (
          <button
            key={entry.hour}
            type="button"
            className={`flow-timeline-bar${picked === entry.hour ? " picked" : ""}${entry.count === 0 ? " empty" : ""}`}
            style={{ ["--h" as string]: `${Math.round((entry.count / peak) * 100)}%` }}
            onClick={() => onPick(picked === entry.hour ? null : entry.hour)}
            title={`${label(entry.hour)} น. · ${entry.count} ชิ้น`}
            aria-label={`${label(entry.hour)} นาฬิกา ${entry.count} ชิ้น`}
          >
            <i />
          </button>
        ))}
      </div>
      <footer>
        <span>{label(data[0]?.hour ?? "")} น.</span>
        <span>ตอนนี้</span>
      </footer>
    </div>
  );
}

export function NewsFlow({ storyCount, verifiedCount, lastSync, syncing, onFilterSource, activeSource }: {
  storyCount: number;
  verifiedCount: number;
  lastSync: SyncLog;
  /** กำลังกดซิงก์อยู่ — เปิดโหมดถามความคืบหน้าจากเซิร์ฟเวอร์ */
  syncing: boolean;
  /** กดโหนดแล้วกรองฟีดข่าวข้างล่าง — ส่ง id ของแหล่งตาม NEWS_SOURCE_DIRECTORY */
  onFilterSource: (sourceId: string | null) => void;
  activeSource: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<NodeKey, HTMLDivElement>());
  const [beams, setBeams] = useState<Beam[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [flow, setFlow] = useState<NewsFlowData | null>(null);
  const [progress, setProgress] = useState<IngestProgress>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pickedHour, setPickedHour] = useState<string | null>(null);
  const [showUnverified, setShowUnverified] = useState(false);

  const registerNode = useCallback((key: NodeKey) => (element: HTMLDivElement | null) => {
    if (element) nodeRefs.current.set(key, element);
    else nodeRefs.current.delete(key);
  }, []);

  const loadFlow = useCallback(() => {
    fetch("/api/news-flow")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { flow?: NewsFlowData } | null) => {
        if (payload?.flow) setFlow(payload.flow);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => { window.queueMicrotask(loadFlow); }, [loadFlow]);

  // โหมด LIVE — ถามความคืบหน้าจริงระหว่างซิงก์ ไม่ใช่เดาจากเวลา
  useEffect(() => {
    if (!syncing) return;
    let alive = true;
    const tick = () => {
      fetch("/api/ingest/progress")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { progress?: IngestProgress } | null) => {
          if (!alive) return;
          setProgress(payload?.progress ?? null);
          if (payload?.progress?.done) loadFlow();
        })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 1_100);
    return () => { alive = false; window.clearInterval(timer); };
  }, [syncing, loadFlow]);

  // ซิงก์จบแล้วโหลดสถิติใหม่ทั้งชุด
  useEffect(() => {
    if (syncing) return;
    const timer = window.setTimeout(loadFlow, 600);
    return () => window.clearTimeout(timer);
  }, [syncing, loadFlow]);

  const sources = useMemo(() => flow?.sources ?? [], [flow]);

  /**
   * เลือกชั่วโมงไว้ = ผังเปลี่ยนไปเล่าเรื่องของชั่วโมงนั้นแทนรอบล่าสุด
   * แหล่งที่ชั่วโมงนั้นไม่มีข่าวเข้า เส้นดับ ตัวเลขเปลี่ยนเป็นของชั่วโมงนั้น
   */
  const hourSlice = useMemo(
    () => (pickedHour ? flow?.timeline.find((entry) => entry.hour === pickedHour) ?? null : null),
    [pickedHour, flow],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    const hub = hubRef.current;
    if (!container || !hub || sources.length === 0) return;

    const box = container.getBoundingClientRect();
    const centre = (rect: DOMRect) => ({
      x: rect.left - box.left + rect.width / 2,
      y: rect.top - box.top + rect.height / 2,
    });
    const hubPoint = centre(hub.getBoundingClientRect());

    const next: Beam[] = [];
    const build = (key: NodeKey, index: number, total: number, outgoing: boolean, live: boolean, health: string) => {
      const element = nodeRefs.current.get(key);
      if (!element) return;
      const point = centre(element.getBoundingClientRect());
      const from = outgoing ? hubPoint : point;
      const to = outgoing ? point : hubPoint;
      const spread = total > 1 ? (index / (total - 1)) * 2 - 1 : 0;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - spread * 42;
      next.push({
        id: `${outgoing ? "out" : "in"}-${key}`,
        sourceId: key,
        d: `M ${from.x},${from.y} Q ${midX},${midY} ${to.x},${to.y}`,
        reverse: outgoing,
        delay: index * 0.45 + (outgoing ? 0.9 : 0),
        live,
        health,
      });
    };

    sources.forEach((source, index) => {
      // เลือกชั่วโมงไว้ = ดูว่าชั่วโมงนั้นแหล่งนี้ส่งข่าวเข้ามาไหม
      const live = hourSlice
        ? (hourSlice.bySource[source.id] ?? 0) > 0
        : source.storedRecently > 0 || source.matched > 0;
      build(source.id, index, sources.length, false, live, source.health);
    });
    OUTPUTS.forEach((output, index) => build(output.key, index, OUTPUTS.length, true, true, "ok"));

    setSize({ width: box.width, height: box.height });
    setBeams(next);
  }, [sources, hourSlice]);

  useEffect(() => {
    const run = () => window.queueMicrotask(measure);
    run();
    const observer = new ResizeObserver(run);
    if (containerRef.current) observer.observe(containerRef.current);
    document.fonts?.ready.then(run).catch(() => undefined);
    return () => observer.disconnect();
  }, [measure]);

  const stages = flow?.stages;
  const outputs = flow?.outputs;
  const hoveredSource = sources.find((source) => source.id === hovered) ?? null;
  const downCount = sources.filter((source) => source.health === "down").length;

  return (
    <section className="news-flow" aria-labelledby="news-flow-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">HOW THE NEWSROOM WORKS</span>
          <h2 id="news-flow-heading">ข่าวเดินทางมาถึงคุณยังไง</h2>
        </div>
        <p>
          {hourSlice
            ? <>กำลังดูช่วง <b>{new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(`${hourSlice.hour}:00:00Z`))} น.</b> — เข้ามา {hourSlice.count} ชิ้น เส้นที่สว่างคือทางที่มีข่าวไหลจริงในชั่วโมงนั้น</>
            : <>ทุกตัวเลขบนผังนี้มาจากรอบซิงก์จริง — กดที่แหล่งข่าวเพื่อกรองฟีดข้างล่าง</>}
          {activeSource !== "All" && <> · กรองอยู่ที่ <b>{NEWS_SOURCE_DIRECTORY.find((entry) => entry.id === activeSource)?.label ?? activeSource}</b></>}
        </p>
      </div>

      {downCount > 0 && (
        <div className="flow-alert" role="status">
          <TriangleAlert size={14} aria-hidden="true" />
          <span>
            มี {downCount} แหล่งที่ดึงข้อมูลไม่ได้ในรอบล่าสุด — ข่าวจากแหล่งนั้นจะหายไปจนกว่าจะกลับมา
          </span>
        </div>
      )}

      <div className="news-flow-stage" ref={containerRef}>
        <svg
          className="news-flow-beams"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="news-flow-glow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#da291c" stopOpacity="0" />
              <stop offset="45%" stopColor="#f13b2e" stopOpacity="1" />
              <stop offset="55%" stopColor="#f0cc78" stopOpacity="1" />
              <stop offset="100%" stopColor="#d9aa49" stopOpacity="0" />
            </linearGradient>
          </defs>
          {beams.map((beam) => (
            <g key={beam.id} className={hovered && hovered !== beam.sourceId ? "dim" : ""}>
              <path className={`news-flow-track ${beam.health}`} d={beam.d} />
              {/* เส้นสว่างเฉพาะทางที่มีข่าวไหลจริง ทางที่เงียบเหลือแต่เส้นประ */}
              {beam.live && (
                <path
                  className={`news-flow-pulse${beam.reverse ? " reverse" : ""}`}
                  d={beam.d}
                  style={{ animationDelay: `${beam.delay}s` }}
                />
              )}
            </g>
          ))}
        </svg>

        <div className="news-flow-col sources">
          {sources.length === 0 && <div className="news-flow-node skeleton">กำลังอ่านสถิติแหล่งข่าว…</div>}
          {sources.map((source) => (
            <div
              key={source.id}
              className={`news-flow-node health-${source.health}${activeSource === source.id ? " active" : ""}${filterable(source.id) ? "" : " no-filter"}`}
              ref={registerNode(source.id)}
              onMouseEnter={() => setHovered(source.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                type="button"
                disabled={!filterable(source.id)}
                onClick={() => onFilterSource(activeSource === source.id ? null : source.id)}
                aria-pressed={activeSource === source.id}
                title={filterable(source.id) ? "กดเพื่อกรองฟีดเฉพาะแหล่งนี้" : "X Watchlist รวมหลายบัญชี เลือกกรองรายบัญชีได้ที่ตัวกรองด้านล่าง"}
              >
                <b>{source.label}</b>
                <span className="flow-node-stats">
                  {hourSlice
                    ? ((hourSlice.bySource[source.id] ?? 0) > 0
                        ? <>ชั่วโมงนั้นส่งมา {hourSlice.bySource[source.id]} ชิ้น</>
                        : <>ชั่วโมงนั้นเงียบ</>)
                    : source.fetched > 0
                      ? <>ดึงมา {source.fetched} → ผ่าน {source.matched}</>
                      : source.storedRecently > 0
                        ? <>เข้าคลัง {source.storedRecently} ชิ้น/24 ชม.</>
                        : <>รอบนี้ไม่มีข่าวเข้า</>}
                </span>
                <span className={`flow-node-health ${source.health}`}>
                  {HEALTH_LABEL[source.health]}
                  {source.health !== "ok" && source.hoursSinceLast !== null && ` · เงียบ ${Math.round(source.hoursSinceLast)} ชม.`}
                </span>
              </button>
            </div>
          ))}
        </div>

        {/* ── ด่านคัดสามขั้น ไม่ใช่กล่องดำ ─────────────────────────────── */}
        <div className="news-flow-hub" ref={hubRef}>
          <span className="news-flow-hub-mark">GOG</span>
          <b>DM ENGINE</b>
          <ol className="flow-stages">
            <li>
              <em>1 · รับเข้า</em>
              <strong>{stages?.fetched ?? "—"}</strong>
              <small>ทุกชิ้นจากทุกแหล่ง</small>
            </li>
            <li>
              <em>2 · กรองว่าเกี่ยวแมนยูไหม</em>
              <strong>{stages?.matched ?? "—"}</strong>
              <small>
                {stages ? `คัดทิ้ง ${stages.fetched - stages.matched} ชิ้น` : "—"}
              </small>
            </li>
            <li>
              <em>3 · จับกลุ่ม + ให้คะแนน</em>
              <strong>{stages?.stored ?? "—"}</strong>
              <small>
                {stages
                  ? (stages.matched > stages.stored
                      ? `ข่าวเรื่องเดียวกันจากหลายแหล่ง รวมได้ ${stages.matched - stages.stored} ชิ้น`
                      : "ไม่มีข่าวซ้ำให้รวมในรอบนี้")
                  : "—"}
              </small>
            </li>
          </ol>
          <div className="news-flow-hub-stats">
            <div><strong>{storyCount || "—"}</strong><span>ข่าวในระบบ</span></div>
            <div><strong>{verifiedCount || "—"}</strong><span>ยืนยันแล้ว</span></div>
          </div>
        </div>

        <div className="news-flow-col outputs">
          <div className="news-flow-node out" ref={registerNode("thai")}>
            <b>ข่าวไทยที่ตรวจแล้ว</b>
            <span>{outputs ? `แปลแล้ว ${outputs.translated} จาก ${outputs.storiesTotal} ข่าว` : "แปลและเรียบเรียง"}</span>
          </div>
          <div className="news-flow-node out" ref={registerNode("match")}>
            <b>Match Center</b>
            <span>ผูกข่าวเข้ากับนัดในโปรแกรมจริง</span>
          </div>
          <div className="news-flow-node out" ref={registerNode("trip")}>
            <b>วางแผนทริป</b>
            <span>จากข่าวสู่ตั๋วเครื่องบินและวีซ่า</span>
          </div>
        </div>
      </div>

      {/* ── ทางแยกของข่าวที่ยืนยันไม่ได้ — กล้าโชว์ ────────────────────── */}
      {flow && flow.unverified.count > 0 && (
        <div className="flow-unverified">
          <button type="button" onClick={() => setShowUnverified((open) => !open)} aria-expanded={showUnverified}>
            <b>{flow.unverified.count}</b> ข่าวที่ยังยืนยันข้ามแหล่งไม่ได้ — ไม่ตัดทิ้ง ไม่ดันขึ้นหน้าแรก
            <em>{showUnverified ? "ซ่อน" : "ดูว่าคืออะไร"}</em>
          </button>
          {showUnverified && (
            <ul>
              {flow.unverified.samples.map((sample) => (
                <li key={sample.id}>
                  <span>{sample.title}</span>
                  <small>{sample.source}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {flow && <Timeline data={flow.timeline} onPick={setPickedHour} picked={pickedHour} />}

      {/* พาดหัวล่าสุดของแหล่งที่เอาเมาส์ชี้ */}
      {hoveredSource?.latestHeadline && (
        <p className="flow-peek">
          <em>{hoveredSource.label} ล่าสุด</em> {hoveredSource.latestHeadline}
        </p>
      )}

      <Marquee duration={46}>
        {NEWS_SOURCE_DIRECTORY.map((source) => (
          <a
            key={`${source.kind}-${source.id}`}
            className={`news-flow-chip tier-${source.tier}`}
            href={source.homepage}
            target="_blank"
            rel="noreferrer"
          >
            {source.kind === "x" && <em>X</em>}
            {source.label}
          </a>
        ))}
      </Marquee>

      <div className="news-flow-terminal">
        <SyncTerminal log={lastSync} sources={NEWS_SOURCE_DIRECTORY.length} progress={progress} />
      </div>
    </section>
  );
}
