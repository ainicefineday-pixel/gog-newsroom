"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from "lucide-react";
import { ANTHEM_LYRICS, ANTHEM_TRACK, ANTHEM_TRACKS, type LyricLine } from "@/config/anthem-lyrics";

const BAR_COUNT = 44;
const SYNC_STORAGE_KEY = "gog-anthem-sync";
/** ก้าวถอยหลัง/เดินหน้าเวลากดปุ่มกรอ */
const SEEK_STEP = 10;
const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Config timings, overlaid with anything captured in the sync tool. */
function resolveTimings(captured: Record<number, number>) {
  const timed: Array<{ line: LyricLine; time: number }> = [];
  for (const line of ANTHEM_LYRICS) {
    const time = captured[line.id] ?? line.time;
    if (typeof time === "number") timed.push({ line, time });
  }
  return timed.sort((a, b) => a.time - b.time);
}

export function AnthemPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef(0);
  const lyricListRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(ANTHEM_TRACK.durationSeconds);
  const [syncMode, setSyncMode] = useState(false);
  const [captured, setCaptured] = useState<Record<number, number>>({});
  const [syncCursor, setSyncCursor] = useState(0);
  const [copied, setCopied] = useState(false);
  const [speed, setSpeed] = useState(1);

  const timedLines = useMemo(() => resolveTimings(captured), [captured]);
  const activeLineId = useMemo(() => {
    let id: number | null = null;
    for (const entry of timedLines) {
      if (entry.time <= currentTime + 0.15) id = entry.line.id;
      else break;
    }
    return id;
  }, [timedLines, currentTime]);

  // ?sync=1 turns the dock into a timing recorder. Kept out of the normal UI so
  // visitors never see it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sync") !== "1") return;
    // The query string only exists in the browser, so this state cannot be
    // derived during render without breaking hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncMode(true);
    setExpanded(true);
    try {
      const saved = window.localStorage.getItem(SYNC_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<number, number>;
        setCaptured(parsed);
        setSyncCursor(Object.keys(parsed).length);
      }
    } catch {
      // A corrupt draft is not worth blocking the tool for.
    }
  }, []);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      await audio.play();
      setNeedsGesture(false);
      return true;
    } catch {
      setNeedsGesture(true);
      return false;
    }
  }, []);

  // Every browser blocks audible autoplay until the visitor interacts, so we try
  // once and otherwise start on whatever their first tap or key press happens to be.
  useEffect(() => {
    let cancelled = false;
    const events: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "touchstart"];
    const kick = () => {
      void startPlayback();
    };
    void (async () => {
      const started = await startPlayback();
      if (started || cancelled) return;
      events.forEach((event) => document.addEventListener(event, kick, { once: true, passive: true }));
    })();
    return () => {
      cancelled = true;
      events.forEach((event) => document.removeEventListener(event, kick));
    };
  }, [startPlayback]);

  // Routing audio through an AudioContext silences it while that context is
  // suspended, which is the default on iOS. Any interaction wakes it back up.
  useEffect(() => {
    const wake = () => { void contextRef.current?.resume(); };
    document.addEventListener("pointerdown", wake, { passive: true });
    document.addEventListener("keydown", wake, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", wake);
      document.removeEventListener("keydown", wake);
    };
  }, []);

  // The analyser can only be wired once playback exists, and only once per element.
  const attachAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || contextRef.current) return;
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    try {
      const context = new AudioContextCtor();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      analyser.connect(context.destination);
      contextRef.current = context;
      analyserRef.current = analyser;
    } catch {
      // Without an analyser the dock still plays; only the bars go idle.
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    attachAnalyser();
    void contextRef.current?.resume();
  }, [playing, attachAnalyser]);

  // Draw the bars from live frequency data so they follow the actual beat.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const render = () => {
      frameRef.current = window.requestAnimationFrame(render);
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth * ratio;
      const height = canvas.clientHeight * ratio;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      const levels = new Uint8Array(BAR_COUNT);
      if (analyser && playing) {
        const spectrum = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(spectrum);
        for (let index = 0; index < BAR_COUNT; index += 1) {
          // Low frequencies carry the beat, so weight the low bins wider.
          const bin = Math.floor((index / BAR_COUNT) ** 1.6 * spectrum.length);
          levels[index] = spectrum[bin] ?? 0;
        }
      }

      const gap = 2 * ratio;
      const barWidth = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      for (let index = 0; index < BAR_COUNT; index += 1) {
        const level = levels[index] / 255;
        const barHeight = Math.max(2 * ratio, level * height);
        const x = index * (barWidth + gap);
        const gradient = context.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, "#da291c");
        gradient.addColorStop(1, "rgba(217,170,73,.55)");
        context.fillStyle = level > 0.02 ? gradient : "rgba(123,129,137,.28)";
        context.fillRect(x, height - barHeight, barWidth, barHeight);
      }
    };

    frameRef.current = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [playing]);

  // Keep the running line in view without hijacking a manual scroll.
  useEffect(() => {
    if (!expanded || activeLineId === null) return;
    const node = lyricListRef.current?.querySelector(`[data-line="${activeLineId}"]`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLineId, expanded]);

  const stampLine = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || syncCursor >= ANTHEM_LYRICS.length) return;
    const line = ANTHEM_LYRICS[syncCursor];
    setCaptured((previous) => {
      const next = { ...previous, [line.id]: Number(audio.currentTime.toFixed(2)) };
      window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSyncCursor((cursor) => cursor + 1);
  }, [syncCursor]);

  const undoStamp = useCallback(() => {
    if (syncCursor === 0) return;
    const line = ANTHEM_LYRICS[syncCursor - 1];
    setCaptured((previous) => {
      const next = { ...previous };
      delete next[line.id];
      window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSyncCursor((cursor) => cursor - 1);
  }, [syncCursor]);

  useEffect(() => {
    if (!syncMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); stampLine(); }
      if (event.code === "Backspace") { event.preventDefault(); undoStamp(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [syncMode, stampLine, undoStamp]);

  const copyTimings = useCallback(async () => {
    const payload = ANTHEM_LYRICS.map((line) => {
      const time = captured[line.id] ?? line.time;
      return `  { id: ${line.id}, time: ${time === null || time === undefined ? "null" : time} },`;
    }).join("\n");
    await navigator.clipboard.writeText(`[\n${payload}\n]`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }, [captured]);

  // ไฟล์เดียวมีสองเพลง — แทร็กที่กำลังเล่นคือแทร็กสุดท้ายที่จุดเริ่มยังไม่เกินเวลาปัจจุบัน
  const trackIndex = useMemo(() => {
    let index = 0;
    ANTHEM_TRACKS.forEach((track, position) => {
      if (currentTime + 0.05 >= track.startSeconds) index = position;
    });
    return index;
  }, [currentTime]);
  const track = ANTHEM_TRACKS[trackIndex] ?? ANTHEM_TRACKS[0];

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const limit = audio.duration || duration || ANTHEM_TRACK.durationSeconds;
    const next = Math.min(Math.max(seconds, 0), Math.max(limit - 0.3, 0));
    audio.currentTime = next;
    setCurrentTime(next);
  }, [duration]);

  /**
   * ปุ่มย้อนกลับทำสองหน้าที่แบบเครื่องเล่นทั่วไป: กดตอนเพิ่งเริ่มเพลง (ไม่เกิน 3 วิ)
   * คือถอยไปเพลงก่อนหน้า ถ้าเล่นมาเกินนั้นคือย้อนกลับไปต้นเพลงปัจจุบัน
   */
  const goPrevious = useCallback(() => {
    const elapsedInTrack = currentTime - track.startSeconds;
    if (elapsedInTrack > 3 || trackIndex === 0) {
      seekTo(track.startSeconds);
      return;
    }
    seekTo(ANTHEM_TRACKS[trackIndex - 1].startSeconds);
  }, [currentTime, track, trackIndex, seekTo]);

  const goNext = useCallback(() => {
    const next = ANTHEM_TRACKS[trackIndex + 1];
    // เพลงสุดท้ายแล้ววนกลับไปเพลงแรก เพราะไฟล์ตั้ง loop ไว้อยู่แล้ว
    seekTo(next ? next.startSeconds : ANTHEM_TRACKS[0].startSeconds);
  }, [trackIndex, seekTo]);

  const cycleSpeed = useCallback(() => {
    const position = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    const next = SPEEDS[(position + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  // ตั้งความเร็วซ้ำหลังเปลี่ยนไฟล์/โหลดใหม่ ไม่งั้นเบราว์เซอร์รีเซ็ตกลับเป็น 1
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const activeLine = ANTHEM_LYRICS.find((line) => line.id === activeLineId) ?? null;
  const pendingLine = syncMode ? ANTHEM_LYRICS[syncCursor] ?? null : null;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section className={`anthem-dock${expanded ? " expanded" : ""}${syncMode ? " sync" : ""}`} aria-label="เพลงประจำ GOG">
      {/* The bilingual lyrics panel below is this track's caption surface, so a
          <track> file would duplicate it. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={ANTHEM_TRACK.src}
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || ANTHEM_TRACK.durationSeconds)}
      />

      <div className="anthem-bar">
        <div className="anthem-controls">
          <button type="button" className="anthem-step" onClick={goPrevious} aria-label="เพลงก่อนหน้า">
            <SkipBack size={14} aria-hidden="true" />
          </button>
          <button type="button" className="anthem-step" onClick={() => seekTo(currentTime - SEEK_STEP)} aria-label={`ถอยหลัง ${SEEK_STEP} วินาที`}>
            <RotateCcw size={14} aria-hidden="true" />
            <em>{SEEK_STEP}</em>
          </button>
          <button
            type="button"
            className="anthem-toggle"
            onClick={() => (playing ? audioRef.current?.pause() : void startPlayback())}
            aria-label={playing ? "หยุดเพลงชั่วคราว" : "เล่นเพลง"}
          >
            {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          </button>
          <button type="button" className="anthem-step" onClick={() => seekTo(currentTime + SEEK_STEP)} aria-label={`เดินหน้า ${SEEK_STEP} วินาที`}>
            <RotateCw size={14} aria-hidden="true" />
            <em>{SEEK_STEP}</em>
          </button>
          <button type="button" className="anthem-step" onClick={goNext} aria-label="เพลงถัดไป">
            <SkipForward size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="anthem-meta">
          <b>{track.title}</b>
          <small>
            {needsGesture
              ? "แตะที่ไหนก็ได้เพื่อเริ่มเพลง"
              : `${track.subtitle} · เพลงที่ ${trackIndex + 1}/${ANTHEM_TRACKS.length}`}
          </small>
        </div>

        <button
          type="button"
          className="anthem-seek"
          aria-label="เลื่อนตำแหน่งเพลง"
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            seekTo(((event.clientX - box.left) / box.width) * (duration || ANTHEM_TRACK.durationSeconds));
          }}
        >
          <span className="anthem-seek-track">
            <i style={{ width: `${progress}%` }} />
            {ANTHEM_TRACKS.slice(1).map((entry) => (
              <b key={entry.id} style={{ left: `${(entry.startSeconds / (duration || ANTHEM_TRACK.durationSeconds)) * 100}%` }} />
            ))}
          </span>
          <span className="anthem-clock">{formatClock(currentTime)} / {formatClock(duration)}</span>
        </button>

        <canvas ref={canvasRef} className="anthem-wave" aria-hidden="true" />

        <div className="anthem-tools">
          <button type="button" className="anthem-speed" onClick={cycleSpeed} aria-label={`ความเร็ว ${speed} เท่า กดเพื่อเปลี่ยน`}>
            {speed}×
          </button>
          <a
            className="anthem-download"
            href={ANTHEM_TRACK.downloadSrc}
            download={ANTHEM_TRACK.downloadName}
            aria-label="ดาวน์โหลดเพลง"
          >
            <Download size={13} aria-hidden="true" />
            <span>โหลดเพลง</span>
          </a>
          <button
            type="button"
            className="anthem-expand"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            {expanded ? "ซ่อนเนื้อเพลง" : "เนื้อเพลง"}
          </button>
        </div>
      </div>

      <div className="anthem-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>

      {!expanded && activeLine && (
        <p className="anthem-ticker"><span>{activeLine.en.replace(/\n/g, " ")}</span><small>{activeLine.th.replace(/\n/g, " ")}</small></p>
      )}

      {expanded && (
        <div className="anthem-panel">
          {syncMode && (
            <div className="anthem-sync-bar">
              <div>
                <span>โหมดจับจังหวะ · {syncCursor}/{ANTHEM_LYRICS.length}</span>
                <b>{pendingLine ? pendingLine.en.replace(/\n/g, " ") : "ครบทุกท่อนแล้ว"}</b>
                <small>กด Space ทุกครั้งที่ท่อนใหม่เริ่มร้อง · Backspace เพื่อย้อนกลับ</small>
              </div>
              <div className="anthem-sync-actions">
                <button type="button" onClick={stampLine} disabled={!pendingLine}>จับเวลา (Space)</button>
                <button type="button" onClick={undoStamp} disabled={syncCursor === 0}>ย้อนกลับ</button>
                <button type="button" className="primary" onClick={() => void copyTimings()}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกผลลัพธ์"}</button>
              </div>
            </div>
          )}

          <div className="anthem-lyrics" ref={lyricListRef}>
            {ANTHEM_LYRICS.map((line, index) => (
              <div
                key={line.id}
                data-line={line.id}
                className={`anthem-line${line.id === activeLineId ? " active" : ""}${syncMode && index === syncCursor ? " pending" : ""}${(captured[line.id] ?? line.time) === null || (captured[line.id] ?? line.time) === undefined ? " untimed" : ""}`}
              >
                {line.section && <span className="anthem-section">{line.section}</span>}
                <b>{line.en}</b>
                <small>{line.th}</small>
                {(captured[line.id] ?? line.time) === null && <em>ไม่ได้ร้องในเวอร์ชันนี้</em>}
              </div>
            ))}
          </div>

          <p className="anthem-foot">
            <span>{formatClock(currentTime)} / {formatClock(duration)}</span>
            {timedLines.length === 0 && <em>ยังไม่ได้จับจังหวะ — เนื้อร้องจะยังไม่เลื่อนตามเพลง</em>}
          </p>
        </div>
      )}
    </section>
  );
}
