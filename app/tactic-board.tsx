"use client";

import { useEffect, useMemo, useState } from "react";
import { MU_PREMIER_LEAGUE_FIXTURES } from "@/config/mu-fixtures";
import {
  MU_FIRST_TEAM_SQUAD,
  MU_SQUAD_SOURCE,
  MU_SQUAD_VERIFIED_AT,
  type SquadPlayer,
  type SquadPosition,
} from "@/config/mu-squad";

type Formation = "4-2-3-1" | "3-4-2-1" | "4-3-3";
type Availability = "unverified" | "available" | "doubt" | "out";
type EditablePlayer = SquadPlayer & { availability: Availability };
type PitchSlot = { id: string; label: string; x: number; y: number };

const SQUAD_STORAGE_KEY = "gog-tactics-squad-v1";
const PLAN_STORAGE_KEY = "gog-tactics-plan-v1";

const FORMATION_SLOTS: Record<Formation, PitchSlot[]> = {
  "4-2-3-1": [
    { id: "st", label: "ST", x: 50, y: 11 },
    { id: "lam", label: "LAM", x: 22, y: 30 }, { id: "cam", label: "CAM", x: 50, y: 32 }, { id: "ram", label: "RAM", x: 78, y: 30 },
    { id: "ldm", label: "DM", x: 37, y: 51 }, { id: "rdm", label: "DM", x: 63, y: 51 },
    { id: "lb", label: "LB", x: 16, y: 70 }, { id: "lcb", label: "CB", x: 38, y: 73 }, { id: "rcb", label: "CB", x: 62, y: 73 }, { id: "rb", label: "RB", x: 84, y: 70 },
    { id: "gk", label: "GK", x: 50, y: 90 },
  ],
  "3-4-2-1": [
    { id: "st", label: "ST", x: 50, y: 10 },
    { id: "lam", label: "AM", x: 34, y: 29 }, { id: "ram", label: "AM", x: 66, y: 29 },
    { id: "lwb", label: "LWB", x: 15, y: 50 }, { id: "lcm", label: "CM", x: 38, y: 51 }, { id: "rcm", label: "CM", x: 62, y: 51 }, { id: "rwb", label: "RWB", x: 85, y: 50 },
    { id: "lcb", label: "CB", x: 29, y: 73 }, { id: "cb", label: "CB", x: 50, y: 76 }, { id: "rcb", label: "CB", x: 71, y: 73 },
    { id: "gk", label: "GK", x: 50, y: 91 },
  ],
  "4-3-3": [
    { id: "lw", label: "LW", x: 21, y: 19 }, { id: "st", label: "ST", x: 50, y: 10 }, { id: "rw", label: "RW", x: 79, y: 19 },
    { id: "lcm", label: "CM", x: 31, y: 45 }, { id: "dm", label: "DM", x: 50, y: 53 }, { id: "rcm", label: "CM", x: 69, y: 45 },
    { id: "lb", label: "LB", x: 16, y: 70 }, { id: "lcb", label: "CB", x: 38, y: 74 }, { id: "rcb", label: "CB", x: 62, y: 74 }, { id: "rb", label: "RB", x: 84, y: 70 },
    { id: "gk", label: "GK", x: 50, y: 91 },
  ],
};

const DEFAULT_LINEUPS: Record<Formation, Record<string, string>> = {
  "4-2-3-1": { st: "benjamin-sesko", lam: "matheus-cunha", cam: "bruno-fernandes", ram: "bryan-mbeumo", ldm: "manuel-ugarte", rdm: "youri-tielemans", lb: "luke-shaw", lcb: "lisandro-martinez", rcb: "matthijs-de-ligt", rb: "diogo-dalot", gk: "senne-lammens" },
  "3-4-2-1": { st: "benjamin-sesko", lam: "matheus-cunha", ram: "bruno-fernandes", lwb: "patrick-dorgu", lcm: "youri-tielemans", rcm: "manuel-ugarte", rwb: "amad", lcb: "luke-shaw", cb: "matthijs-de-ligt", rcb: "leny-yoro", gk: "senne-lammens" },
  "4-3-3": { lw: "matheus-cunha", st: "benjamin-sesko", rw: "bryan-mbeumo", lcm: "andrey-santos", dm: "manuel-ugarte", rcm: "bruno-fernandes", lb: "patrick-dorgu", lcb: "lisandro-martinez", rcb: "matthijs-de-ligt", rb: "diogo-dalot", gk: "senne-lammens" },
};

const POSITION_LABELS: Record<SquadPosition, string> = {
  Goalkeeper: "ผู้รักษาประตู",
  Defender: "กองหลัง",
  Midfielder: "กองกลาง",
  Forward: "กองหน้า",
};

const AVAILABILITY_LABELS: Record<Availability, string> = {
  unverified: "รอยืนยันสถานะ",
  available: "พร้อมลงสนาม",
  doubt: "ต้องเช็กความฟิต",
  out: "ไม่พร้อมใช้งาน",
};

function baselineSquad(): EditablePlayer[] {
  return MU_FIRST_TEAM_SQUAD.map((player) => ({ ...player, availability: "unverified" }));
}

function fixtureOpponent(fixture: (typeof MU_PREMIER_LEAGUE_FIXTURES)[number]) {
  return fixture.home === "Manchester United" ? fixture.away : fixture.home;
}

function fixtureDateTime(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function editableCopy(player?: EditablePlayer): EditablePlayer {
  return player ? { ...player } : {
    id: "",
    number: 0,
    name: "",
    shortName: "",
    position: "Midfielder",
    availability: "unverified",
  };
}

export function TacticBoardPanel() {
  const [formation, setFormation] = useState<Formation>("4-2-3-1");
  const [lineup, setLineup] = useState<Record<string, string>>(DEFAULT_LINEUPS["4-2-3-1"]);
  const [squad, setSquad] = useState<EditablePlayer[]>(baselineSquad);
  const [selectedSlot, setSelectedSlot] = useState("st");
  const [positionFilter, setPositionFilter] = useState<SquadPosition | "All">("All");
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [editor, setEditor] = useState<EditablePlayer | null>(null);
  const [editorError, setEditorError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      try {
        const storedSquad = window.localStorage.getItem(SQUAD_STORAGE_KEY);
        const storedPlan = window.localStorage.getItem(PLAN_STORAGE_KEY);
        if (storedSquad) setSquad(JSON.parse(storedSquad) as EditablePlayer[]);
        if (storedPlan) {
          const parsed = JSON.parse(storedPlan) as { formation?: Formation; lineup?: Record<string, string>; fixtureIndex?: number };
          if (parsed.formation && FORMATION_SLOTS[parsed.formation]) setFormation(parsed.formation);
          if (parsed.lineup) setLineup(parsed.lineup);
          if (typeof parsed.fixtureIndex === "number") setFixtureIndex(Math.min(Math.max(parsed.fixtureIndex, 0), MU_PREMIER_LEAGUE_FIXTURES.length - 1));
        }
      } catch {
        setSquad(baselineSquad());
      } finally {
        setHydrated(true);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SQUAD_STORAGE_KEY, JSON.stringify(squad));
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ formation, lineup, fixtureIndex }));
  }, [fixtureIndex, formation, hydrated, lineup, squad]);

  const selectedFixture = MU_PREMIER_LEAGUE_FIXTURES[fixtureIndex];
  const assignedIds = useMemo(() => new Set(Object.values(lineup)), [lineup]);
  const visibleSquad = useMemo(() => squad
    .filter((player) => positionFilter === "All" || player.position === positionFilter)
    .sort((left, right) => left.position.localeCompare(right.position) || left.number - right.number), [positionFilter, squad]);
  const playerById = useMemo(() => new Map(squad.map((player) => [player.id, player])), [squad]);

  const changeFormation = (next: Formation) => {
    setFormation(next);
    setLineup({ ...DEFAULT_LINEUPS[next] });
    setSelectedSlot(FORMATION_SLOTS[next][0].id);
  };

  const assignPlayer = (playerId: string) => {
    if (!selectedSlot) return;
    setLineup((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, assigned]) => assigned !== playerId));
      next[selectedSlot] = playerId;
      return next;
    });
  };

  const removeSelectedPlayer = () => {
    setLineup((current) => Object.fromEntries(Object.entries(current).filter(([slot]) => slot !== selectedSlot)));
  };

  const savePlayer = () => {
    if (!editor) return;
    const name = editor.name.trim();
    const number = Math.round(Number(editor.number));
    if (!name || !Number.isFinite(number) || number < 1 || number > 99) {
      setEditorError("กรอกชื่อและเบอร์เสื้อ 1–99 ให้ครบ");
      return;
    }
    if (squad.some((player) => player.number === number && player.id !== editor.id)) {
      setEditorError(`เบอร์ ${number} มีผู้เล่นใช้อยู่แล้ว`);
      return;
    }
    const id = editor.id || `custom-${Date.now()}`;
    const saved = { ...editor, id, number, name, shortName: editor.shortName.trim() || name.split(" ").at(-1) || name };
    setSquad((current) => current.some((player) => player.id === id)
      ? current.map((player) => player.id === id ? saved : player)
      : [...current, saved]);
    setEditor(null);
    setEditorError("");
  };

  const deletePlayer = () => {
    if (!editor || !window.confirm(`ลบ ${editor.name || "ผู้เล่นนี้"} ออกจากรายชื่อที่บันทึกบนเครื่องนี้?`)) return;
    setSquad((current) => current.filter((player) => player.id !== editor.id));
    setLineup((current) => Object.fromEntries(Object.entries(current).filter(([, playerId]) => playerId !== editor.id)));
    setEditor(null);
  };

  const resetPlanner = () => {
    if (!window.confirm("คืนรายชื่อและแผนตัวอย่างจากข้อมูลทางการล่าสุด?")) return;
    setSquad(baselineSquad());
    setFormation("4-2-3-1");
    setLineup({ ...DEFAULT_LINEUPS["4-2-3-1"] });
    setSelectedSlot("st");
    setFixtureIndex(0);
  };

  return (
    <section className="tactic-view" id="tactics" aria-labelledby="tactic-heading">
      <div className="tactic-hero">
        <div>
          <span className="eyebrow">GOG MATCH LAB · EDITABLE XI</span>
          <h2 id="tactic-heading">กระดานแท็กติกปีศาจแดง</h2>
          <p>จัดตัวจริง เลือกแผน และเตรียมทีมตามคู่แข่ง—เห็นตำแหน่งและเบอร์เสื้อในภาพเดียว</p>
        </div>
        <div className="tactic-save-state"><i /> บันทึกอัตโนมัติบนเครื่องนี้<small>แผนทดลอง · ไม่ใช่ไลน์อัปยืนยัน</small></div>
      </div>

      <div className="tactic-controls">
        <label><span>คู่แข่ง / นัดแข่งขัน</span><select value={fixtureIndex} onChange={(event) => setFixtureIndex(Number(event.target.value))}>{MU_PREMIER_LEAGUE_FIXTURES.map((fixture, index) => <option key={fixture.matchday} value={index}>MW {fixture.matchday} · {fixtureOpponent(fixture)} · {fixture.home === "Manchester United" ? "เหย้า" : "เยือน"}</option>)}</select></label>
        <div className="formation-control"><span>FORMATION</span><div>{(Object.keys(FORMATION_SLOTS) as Formation[]).map((item) => <button key={item} type="button" className={formation === item ? "active" : ""} onClick={() => changeFormation(item)}>{item}</button>)}</div></div>
        <button className="tactic-reset" type="button" onClick={resetPlanner}>คืนค่ารายชื่อทางการ</button>
      </div>

      <div className="opponent-ribbon">
        <span>MW {String(selectedFixture.matchday).padStart(2, "0")}</span>
        <div><b>{selectedFixture.home}</b><i>VS</i><b>{selectedFixture.away}</b></div>
        <strong>{fixtureDateTime(selectedFixture.kickoffUtc)} น. ไทย</strong>
        <small>{selectedFixture.stadium} · {selectedFixture.city} · {selectedFixture.status === "confirmed" ? "ยืนยันเวลาแล้ว" : "รอยืนยันเวลา"}</small>
      </div>

      <div className="tactic-workspace">
        <div className="pitch-column">
          <div className="football-pitch" aria-label={`แผนผังผู้เล่นระบบ ${formation}`}>
            <span className="pitch-halfway" aria-hidden="true" /><span className="pitch-centre" aria-hidden="true" /><span className="pitch-box pitch-box-top" aria-hidden="true" /><span className="pitch-box pitch-box-bottom" aria-hidden="true" />
            <span className="attack-direction" aria-hidden="true">ATTACK ↑</span>
            {FORMATION_SLOTS[formation].map((slot) => {
              const player = playerById.get(lineup[slot.id]);
              const unavailable = player?.availability === "out";
              return (
                <button key={slot.id} type="button" className={`pitch-player ${selectedSlot === slot.id ? "selected" : ""} ${unavailable ? "unavailable" : ""}`} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onClick={() => setSelectedSlot(slot.id)} aria-label={`${slot.label}: ${player?.name ?? "ยังไม่ได้เลือกผู้เล่น"}`}>
                  <span><b>{player?.number ?? "+"}</b><small>{slot.label}</small></span>
                  <strong>{player?.shortName ?? "เลือกผู้เล่น"}</strong>
                  {player?.availability === "doubt" && <i>!</i>}
                </button>
              );
            })}
          </div>
          <div className="pitch-actions">
            <p><b>วิธีจัดทีม:</b> แตะตำแหน่งบนสนาม แล้วเลือกผู้เล่นจากรายชื่อด้านขวา</p>
            <button type="button" onClick={removeSelectedPlayer} disabled={!lineup[selectedSlot]}>เอาออกจากตำแหน่ง {FORMATION_SLOTS[formation].find((slot) => slot.id === selectedSlot)?.label}</button>
          </div>
        </div>

        <aside className="squad-panel">
          <div className="squad-panel-heading">
            <div><span className="eyebrow">SQUAD DATABASE</span><h3>รายชื่อนักเตะ</h3><small>{squad.length} คน · เลือกแล้ว {assignedIds.size}/11</small></div>
            <button type="button" onClick={() => { setEditor(editableCopy()); setEditorError(""); }}>+ เพิ่มผู้เล่น</button>
          </div>
          <div className="squad-position-tabs">{(["All", "Goalkeeper", "Defender", "Midfielder", "Forward"] as const).map((item) => <button key={item} type="button" className={positionFilter === item ? "active" : ""} onClick={() => setPositionFilter(item)}>{item === "All" ? "ทั้งหมด" : POSITION_LABELS[item]}</button>)}</div>
          <div className="squad-list">
            {visibleSquad.map((player) => (
              <div className={`squad-row ${assignedIds.has(player.id) ? "assigned" : ""} status-${player.availability}`} key={player.id}>
                <button type="button" className="squad-assign" onClick={() => assignPlayer(player.id)} disabled={player.availability === "out"} title={`ส่ง ${player.name} ลงตำแหน่งที่เลือก`}>
                  <b>{player.number}</b><span><strong>{player.name}</strong><small>{POSITION_LABELS[player.position]} · {AVAILABILITY_LABELS[player.availability]}</small></span><i>{assignedIds.has(player.id) ? "✓" : "+"}</i>
                </button>
                <button type="button" className="squad-edit" onClick={() => { setEditor(editableCopy(player)); setEditorError(""); }} aria-label={`แก้ไข ${player.name}`}>•••</button>
              </div>
            ))}
          </div>
          <div className="squad-source"><span>ตรวจรายชื่อพื้นฐาน {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(MU_SQUAD_VERIFIED_AT))}</span><a href={MU_SQUAD_SOURCE} target="_blank" rel="noreferrer">Manchester United ↗</a></div>
        </aside>
      </div>

      {editor && (
        <div className="squad-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
          <section className="squad-editor" role="dialog" aria-modal="true" aria-labelledby="squad-editor-heading">
            <div className="squad-editor-heading"><div><span className="eyebrow">LOCAL SQUAD EDITOR</span><h3 id="squad-editor-heading">{editor.id ? "แก้ไขข้อมูลนักเตะ" : "เพิ่มนักเตะ"}</h3></div><button type="button" onClick={() => setEditor(null)} aria-label="ปิด">×</button></div>
            <div className="squad-editor-grid">
              <label><span>เบอร์เสื้อ</span><input type="number" min="1" max="99" value={editor.number || ""} onChange={(event) => setEditor({ ...editor, number: Number(event.target.value) })} /></label>
              <label className="editor-name"><span>ชื่อเต็ม</span><input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder="Player name" /></label>
              <label><span>ชื่อบนสนาม</span><input value={editor.shortName} onChange={(event) => setEditor({ ...editor, shortName: event.target.value })} placeholder="Short name" /></label>
              <label><span>ตำแหน่ง</span><select value={editor.position} onChange={(event) => setEditor({ ...editor, position: event.target.value as SquadPosition })}>{(Object.keys(POSITION_LABELS) as SquadPosition[]).map((position) => <option key={position} value={position}>{POSITION_LABELS[position]}</option>)}</select></label>
              <label className="editor-status"><span>สถานะความพร้อม</span><select value={editor.availability} onChange={(event) => setEditor({ ...editor, availability: event.target.value as Availability })}>{(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((status) => <option key={status} value={status}>{AVAILABILITY_LABELS[status]}</option>)}</select></label>
            </div>
            {editorError && <p className="editor-error">{editorError}</p>}
            <div className="squad-editor-actions">{editor.id && <button type="button" className="delete" onClick={deletePlayer}>ลบออกจากรายชื่อ</button>}<button type="button" onClick={() => setEditor(null)}>ยกเลิก</button><button type="button" className="save" onClick={savePlayer}>บันทึกข้อมูล</button></div>
            <small>การแก้ไขและสถานะความพร้อมบันทึกเฉพาะบนอุปกรณ์นี้ กรุณาตรวจทีมชีตทางการก่อนเผยแพร่</small>
          </section>
        </div>
      )}
    </section>
  );
}
