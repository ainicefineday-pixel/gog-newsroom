"use client";

// แผนผังสายข่าว — แหล่งข่าว → DM ENGINE → ปลายทาง
// ---------------------------------------------------------------------------
// แนวคิดเดียวกับ AnimatedBeam ของ Magic UI แต่เขียนเองสองเหตุผล
//   1. ต้นฉบับพึ่ง motion/react ซึ่งโปรเจกต์นี้ไม่ได้ติดตั้ง และไม่คุ้มจะเพิ่ม
//      ไลบรารีแอนิเมชันทั้งตัวเพื่อภาพเดียว
//   2. ต้นฉบับใช้ utility class ของ Tailwind ใน JSX ซึ่งไม่ตรงกับที่อื่นของเว็บนี้
// ลำแสงวิ่งด้วย stroke-dashoffset ล้วน ๆ ไม่มีลูป requestAnimationFrame
//
// ตัวเลขในผังมาจากข้อมูลจริงทั้งหมด (จำนวนแหล่งข่าว ข่าวในระบบ ข่าวที่ยืนยันแล้ว)
// ไม่ใช่ภาพประกอบที่เขียนเลขตายตัวไว้ ถ้าเลขไม่ตรงกับของจริงคือผังโกหก

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NEWS_SOURCE_DIRECTORY } from "@/config/news-sources";

type NodeKey = string;

type Beam = {
  id: string;
  d: string;
  /** วิ่งจากปลายไปต้น — ใช้กับฝั่งขาออกเพื่อให้ทุกลำแสงพุ่งออกจากศูนย์กลาง */
  reverse: boolean;
  /** หน่วงให้ลำแสงไม่วิ่งพร้อมกันทุกเส้นจนดูเป็นจังหวะเดียว */
  delay: number;
};

const SOURCES = [
  { key: "bbc", label: "BBC Sport", note: "TIER 1" },
  { key: "athletic", label: "The Athletic", note: "TIER 1" },
  { key: "sky", label: "Sky Sports", note: "TIER 1" },
  { key: "manutd", label: "manutd.com", note: "ต้นทางสโมสร" },
  { key: "men", label: "M.E.N.", note: "TIER 2" },
  { key: "x", label: "X Watchlist", note: "นักข่าวรายบุคคล" },
];

const OUTPUTS = [
  { key: "thai", label: "ข่าวไทยที่ตรวจแล้ว", note: "แปลและเรียบเรียง" },
  { key: "match", label: "Match Center", note: "ผูกข่าวเข้ากับนัด" },
  { key: "trip", label: "วางแผนทริป", note: "จากข่าวสู่การเดินทาง" },
];

export function NewsFlow({ storyCount, verifiedCount }: { storyCount: number; verifiedCount: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  // เก็บ ref ของทุกโหนดไว้ในแมปเดียว ไม่ต้องประกาศ useRef ทีละตัวแบบตัวอย่างต้นทาง
  // ซึ่งจะกลายเป็น 10 บรรทัดที่แก้ยากเวลาเพิ่มแหล่งข่าว
  const nodeRefs = useRef(new Map<NodeKey, HTMLDivElement>());
  const [beams, setBeams] = useState<Beam[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const registerNode = useCallback((key: NodeKey) => (element: HTMLDivElement | null) => {
    if (element) nodeRefs.current.set(key, element);
    else nodeRefs.current.delete(key);
  }, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const hub = hubRef.current;
    if (!container || !hub) return;

    const box = container.getBoundingClientRect();
    const hubBox = hub.getBoundingClientRect();
    const centre = (rect: DOMRect) => ({
      x: rect.left - box.left + rect.width / 2,
      y: rect.top - box.top + rect.height / 2,
    });
    const hubPoint = centre(hubBox);

    const next: Beam[] = [];
    const build = (key: NodeKey, index: number, total: number, outgoing: boolean) => {
      const element = nodeRefs.current.get(key);
      if (!element) return;
      const point = centre(element.getBoundingClientRect());
      const from = outgoing ? hubPoint : point;
      const to = outgoing ? point : hubPoint;
      // โค้งขึ้นสำหรับโหนดบน โค้งลงสำหรับโหนดล่าง โหนดกลางเกือบตรง
      // ทำให้เส้นไม่ทับกันเป็นกระจุกตรงหน้าฮับ
      const spread = total > 1 ? (index / (total - 1)) * 2 - 1 : 0;
      const curvature = -spread * 42;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 + curvature;
      next.push({
        id: `${outgoing ? "out" : "in"}-${key}`,
        d: `M ${from.x},${from.y} Q ${midX},${midY} ${to.x},${to.y}`,
        reverse: outgoing,
        delay: index * 0.45 + (outgoing ? 0.9 : 0),
      });
    };

    SOURCES.forEach((source, index) => build(source.key, index, SOURCES.length, false));
    OUTPUTS.forEach((output, index) => build(output.key, index, OUTPUTS.length, true));

    setSize({ width: box.width, height: box.height });
    setBeams(next);
  }, []);

  useEffect(() => {
    // วัดหลังเบราว์เซอร์จัดหน้าเสร็จ — วัดตอน effect ตรง ๆ จะได้ตำแหน่งก่อนโหลดฟอนต์
    // แล้วเส้นจะเยื้องจากกล่องประมาณสิบพิกเซล
    const run = () => window.queueMicrotask(measure);
    run();
    const observer = new ResizeObserver(run);
    if (containerRef.current) observer.observe(containerRef.current);
    // ฟอนต์ Kanit โหลดจาก Google Fonts ทำให้กล่องขยับหลังเรนเดอร์แรก ต้องวัดใหม่
    document.fonts?.ready.then(run).catch(() => undefined);
    return () => observer.disconnect();
  }, [measure]);

  const stats = useMemo(() => ({
    sources: NEWS_SOURCE_DIRECTORY.length,
    stories: storyCount,
    verified: verifiedCount,
  }), [storyCount, verifiedCount]);

  return (
    <section className="news-flow" aria-labelledby="news-flow-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">HOW THE NEWSROOM WORKS</span>
          <h2 id="news-flow-heading">ข่าวเดินทางมาถึงคุณยังไง</h2>
        </div>
        <p>
          ดึงจาก <b>{stats.sources}</b> แหล่งต้นฉบับ · ตรวจข้ามแหล่งแล้วให้คะแนนความน่าเชื่อถือ ·
          เรียบเรียงเป็นไทยแล้วผูกเข้ากับโปรแกรมแข่งและแผนทริป
        </p>
      </div>

      <div className="news-flow-stage" ref={containerRef}>
        {/* เส้นต้องอยู่ใต้กล่องเสมอ ไม่งั้นลำแสงจะพาดทับตัวหนังสือ */}
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
            <g key={beam.id}>
              <path className="news-flow-track" d={beam.d} />
              <path
                className={`news-flow-pulse${beam.reverse ? " reverse" : ""}`}
                d={beam.d}
                style={{ animationDelay: `${beam.delay}s` }}
              />
            </g>
          ))}
        </svg>

        <div className="news-flow-col sources">
          {SOURCES.map((source) => (
            <div key={source.key} className="news-flow-node" ref={registerNode(source.key)}>
              <b>{source.label}</b>
              <span>{source.note}</span>
            </div>
          ))}
        </div>

        <div className="news-flow-hub" ref={hubRef}>
          <span className="news-flow-hub-mark">GOG</span>
          <b>DM ENGINE</b>
          <span className="news-flow-hub-note">ตรวจข้ามแหล่ง · ให้คะแนน · เรียบเรียงไทย</span>
          <div className="news-flow-hub-stats">
            <div><strong>{stats.stories || "—"}</strong><span>ข่าวในระบบ</span></div>
            <div><strong>{stats.verified || "—"}</strong><span>ยืนยันแล้ว</span></div>
          </div>
        </div>

        <div className="news-flow-col outputs">
          {OUTPUTS.map((output) => (
            <div key={output.key} className="news-flow-node out" ref={registerNode(output.key)}>
              <b>{output.label}</b>
              <span>{output.note}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="news-flow-foot">
        ข่าวชิ้นไหนที่ยืนยันข้ามแหล่งไม่ได้จะติดป้าย &ldquo;ยังไม่ยืนยัน&rdquo; ไว้เสมอ ไม่ตัดทิ้งและไม่ดันขึ้นหน้าแรก
      </p>
    </section>
  );
}
