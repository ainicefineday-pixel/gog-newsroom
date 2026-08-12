"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, ArrowUpRight, BarChart3, Cable, CheckCircle2, CircleDashed, Database, FileSearch, Info, KeyRound, RadioTower, Satellite, ServerCog, ShieldCheck, SlidersHorizontal, Sparkles, Users, Waves } from "lucide-react";

type Player = { name: string; th: string; age: number; role: string; minutes: number; creation: number; threat: number; defence: number; form: number };
type LivePlayer={id:string;canonical_name:string;short_name:string;position:string;updated_at:string;profile:{minutes?:number;total_points?:number;form?:string;status?:string;news?:string}|null;metrics:Record<string,{value:number;confidence:number;minutes:number;cohort:string;observedAt:string}>};
type ConnectionStatus="connected"|"partial"|"ready"|"research"|"not_connected";
const CONNECTIONS:[string,string,ConnectionStatus,string,typeof Cable][]=[
  ["Official FPL","Player snapshots · availability · form","connected","กำลังเติมข้อมูลแมนยูอัตโนมัติทุก 10 นาที",CheckCircle2],["GOG Intelligence Warehouse","D1 snapshots · identity graph · GOG indices","connected","33 player entities พร้อม provenance และ confidence",Database],["API-Football","Live events · lineups · team stats","ready","มี adapter และ fallback router แล้ว · รอ API key/coverage",RadioTower],["football-data.org","Fixtures · scores · standings","ready","มี adapter, cache และ entity mapping แล้ว · สถานะจริงขึ้นกับ token",ServerCog],["StatsBomb Open Data","Historical event model · 360 samples","research","ใช้ฝึกแนวคิดและตรวจสูตรเท่านั้น ไม่ใช่ EPL live feed",FileSearch],["Highlightly","Livescore · highlights · momentum","not_connected","ยังไม่มี adapter หรือ credential",Waves],["Sportmonks","Deep live data · xG · pressure","not_connected","เหมาะเป็นเฟสถัดไปสำหรับ production SME",Satellite],["Sportradar / Opta","Enterprise event feed · advanced metrics","not_connected","ต้องทำสัญญา สิทธิ์เผยแพร่ และ SLA",ShieldCheck],["Genius Sports","Official tracking / low latency","not_connected","ระดับสูงสุด แต่ต้อง license โดยตรง",KeyRound],["SkillCorner / Metrica","Open tracking samples","research","เหมาะ train animation engine ไม่ใช่ข้อมูลแมนยูสด",CircleDashed],["ScoreBat / Odds / TheSportsDB","Video · odds · metadata","not_connected","โมดูลเสริม ไม่ใช่แกน Replay",Cable],
];
const players: Player[] = [
  { name:"Bruno Fernandes",th:"บรูโน แฟร์นันด์ส",age:31,role:"AM",minutes:2790,creation:94,threat:82,defence:67,form:91 },
  { name:"Bryan Mbeumo",th:"ไบรอัน เอ็มเบอโม่",age:27,role:"RW",minutes:2510,creation:79,threat:91,defence:55,form:86 },
  { name:"Matheus Cunha",th:"มาเตอุส คุนญา",age:27,role:"LW",minutes:2280,creation:83,threat:88,defence:48,form:84 },
  { name:"Benjamin Sesko",th:"เบนยามิน เชชโก",age:23,role:"ST",minutes:1870,creation:58,threat:93,defence:44,form:79 },
];
const league = [
  ["Chelsea",24.5,28,72,0,0],["Bournemouth",25.5,24,70,3,3],["Sunderland",25.7,31,52,17,0],
  ["Tottenham",25.7,28,66,6,0],["Man City",25.8,19,67,14,0],["Nott’m Forest",26.2,27,61,12,0],
  ["Man Utd",26.4,34,38,28,0],["Brighton",26.5,39,38,11,12],["Arsenal",26.6,6,77,17,0],
  ["Liverpool",27.0,16,59,25,0],["Leeds Utd",27.1,2,93,0,5],["Newcastle",27.2,16,60,20,4],
  ["Everton",27.8,16,49,29,6],["Aston Villa",28.3,13,52,34,2],["Fulham",28.5,9,50,33,8],
] as const;
const scatter = Array.from({length:52},(_,i)=>({x:49+((i*37)%43),y:46+((i*29)%45),r:4+(i%3)}));
const metrics = [{key:"form",label:"ดัชนีรวม"},{key:"creation",label:"การสร้างสรรค์"},{key:"threat",label:"การคุกคาม"},{key:"defence",label:"เกมรับ"}] as const;

export function DataLab({ embedded = false }: { embedded?: boolean }){
  const [selected,setSelected]=useState(0); const [scenario,setScenario]=useState(0); const player=players[selected];
  const [livePlayers,setLivePlayers]=useState<LivePlayer[]>([]),[health,setHealth]=useState<Record<string,unknown>|null>(null);
  const [footballHealth,setFootballHealth]=useState<{today?:Array<{provider:string;ok_count:number;total:number;last_call:string}>}|null>(null);
  useEffect(()=>{fetch("/api/intelligence/players").then(r=>r.json()).then(data=>{setLivePlayers(data.players??[]);setHealth(data.health??null)}).catch(()=>undefined)},[]);
  useEffect(()=>{fetch("/api/football/health").then(r=>r.json()).then(setFootballHealth).catch(()=>undefined)},[]);
  const projected=useMemo(()=>({age:(26.4+scenario*.12).toFixed(1),youth:Math.max(18,34-scenario*3),prime:Math.min(60,38+scenario*4),exp:Math.max(12,28-scenario)}),[scenario]);
  const Shell = embedded ? "section" : "main";
  return <Shell className={`dl-shell${embedded ? " dl-embedded" : ""}`}>
    {!embedded&&<header className="dl-nav"><Link href="/"><ArrowLeft/> GOG NEWSROOM</Link><b>GOG <span>DATA</span></b><div><Database/> FPL-DERIVED · MODEL PREVIEW</div></header>}
    <section className="dl-hero">
      <div><span className="dl-kicker"><Sparkles/> FOOTBALL INTELLIGENCE, EXPLAINED</span><h1>มองให้ลึกกว่า<br/><em>สกอร์บนสนาม</em></h1><p>ห้องทดลองข้อมูลฟุตบอลที่เปลี่ยนตัวเลขให้เป็นภาพ เปรียบเทียบผู้เล่น สำรวจโครงสร้างทีม และทดลองตลาดซื้อขาย — พร้อมบอกที่มาและสูตรทุกครั้ง</p></div>
      <div className="dl-hero-score"><small>GOG DATA SIGNAL</small><strong>04</strong><span>โมดูลวิเคราะห์</span><i>ข้อมูลจริง + ดัชนีโปร่งใส</i></div>
    </section>

    <section className="intelligence-live"><header><div><span className="live-dot"/><b>GOG PLAYER INTELLIGENCE · LIVE WAREHOUSE</b></div><small>{livePlayers.length} PLAYERS · MODEL v1.0.0 · {health?"SYNC HEALTHY":"AWAITING FIRST SYNC"}</small></header>{livePlayers.length?<div className="intelligence-roster">{livePlayers.map(p=><article key={p.id}><span>{p.position}</span><b>{p.canonical_name}</b><small>{p.profile?.minutes??0} MIN · {p.profile?.total_points??0} PTS</small><div>{["gog_control","gog_threat","gog_output","gog_reliability","gog_momentum"].map(key=><i key={key} title={`${key} · confidence ${Math.round((p.metrics[key]?.confidence??0)*100)}%`}><em>{key.replace("gog_","").slice(0,3).toUpperCase()}</em><strong>{Math.round(p.metrics[key]?.value??0)}</strong></i>)}</div></article>)}</div>:<p className="intelligence-empty">ระบบกำลังรอ Snapshot แรกจากรอบอัตโนมัติ ข้อมูลตัวอย่างด้านล่างยังแยกสถานะออกจากคลังจริงอย่างชัดเจน</p>}</section>
    <section className="connectivity-matrix"><header><div><span>GOG DATA CONNECTIVITY</span><h2>เราเชื่อมถึงระดับไหนแล้ว?</h2></div><p>สถานะตรวจจาก adapter, credential health และข้อมูลที่เข้าฐานจริง · อ้างอิงงานวิจัย API วันที่ 12 สิงหาคม 2026</p></header><div className="connectivity-level"><div><b>{livePlayers.length?"LEVEL 3":"LEVEL 2"}</b><span>CONNECTED INTELLIGENCE</span></div><i><em/><em/><em/><em/><em/></i><p>เป้าหมายถัดไป: verified live events + player match statistics + licensed event coordinates</p></div><div className="connection-grid">{CONNECTIONS.map(([name,coverage,baseStatus,note,Icon])=>{const healthProvider=name==="API-Football"?"api_football":name==="football-data.org"?"football_data":null;const calls=healthProvider?footballHealth?.today?.filter(x=>x.provider===healthProvider)??[]:[];const active=calls.some(x=>Number(x.ok_count)>0);const status:ConnectionStatus=active?"connected":baseStatus;return <article className={`connection-card ${status}`} key={name}><div><Icon/><span className="connection-status">{status.replace("_"," ")}</span></div><b>{name}</b><small>{coverage}</small><p>{active?`มี successful call ใน 24 ชม.ล่าสุด · ${calls.at(0)?.last_call??""}`:note}</p></article>})}</div><footer><span><CheckCircle2/> CONNECTED</span><span><ServerCog/> READY · มี adapter</span><span><FileSearch/> RESEARCH ONLY</span><span><CircleDashed/> NOT CONNECTED</span></footer></section>

    <section className="dl-section"><header><div><span>01 · PLAYER LENS</span><h2>เทียบผู้เล่นตัวรุก ยูไนเต็ด</h2></div><p>Percentile preview เทียบกลุ่มตำแหน่งเดียวกัน · ค่าต่อ 90 นาที</p></header>
      <div className="player-grid">{players.map((p,i)=><button className={i===selected?"active":""} onClick={()=>setSelected(i)} key={p.name}><span>{p.role}</span><b>{p.th}</b><small>{p.name} · อายุ {p.age}</small></button>)}</div>
      <div className="grade-board"><div className="player-focus"><span>{player.role} · MANCHESTER UNITED</span><h3>{player.th}</h3><p>{player.name}</p><div><strong>{player.form}</strong><small>GOG INDEX</small></div><p className="method"><Info/> ดัชนีตัวอย่างจาก Form, Creativity, Threat และ Defensive contribution ที่ Normalize ภายในตำแหน่ง</p></div>
        <div className="grade-list">{metrics.map(m=><div key={m.key}><span>{m.label}</span><i><b style={{width:`${player[m.key]}%`}}/></i><strong>{player[m.key]}</strong><small>P{player[m.key]}</small></div>)}</div></div>
    </section>

    <section className="dl-section dark"><header><div><span>02 · LEAGUE MAP</span><h2>สร้างสรรค์ × คุกคามประตู</h2></div><p>ขนาดวงกลมแทนจำนวนนาที · เส้นประคือ Median ของกลุ่ม</p></header>
      <div className="scatter-wrap"><div className="axis y">THREAT / 90 →</div><div className="scatter"><i className="median-v"/><i className="median-h"/>{scatter.map((d,i)=><span key={i} style={{left:`${d.x}%`,bottom:`${d.y}%`,width:d.r*2,height:d.r*2}}/>)}{players.map((p,i)=><button key={p.name} onClick={()=>setSelected(i)} style={{left:`${p.creation}%`,bottom:`${p.threat}%`}} className={i===selected?"selected":""}><b>{p.th}</b><small>{p.creation} / {p.threat}</small></button>)}</div><div className="axis x">CREATION INDEX →</div></div>
      <div className="quadrants"><span>ตัวจบสกอร์</span><span>ตัวสร้างเกมระดับสูง</span><span>การมีส่วนร่วมน้อย</span><span>สมดุลสองด้าน</span></div>
    </section>

    <section className="dl-section"><header><div><span>03 · SQUAD ARCHITECTURE</span><h2>อายุทีม ถ่วงน้ำหนักด้วยนาที</h2></div><p>ยิ่งนักเตะลงเล่นมาก อายุของเขายิ่งมีน้ำหนักต่อค่าเฉลี่ยทีม</p></header>
      <div className="age-table"><div className="age-head"><b>#</b><b>สโมสร</b><b>W-AGE</b><b>ส่วนผสมอายุ</b><b>YOUTH</b><b>PEAK</b><b>EXP.</b></div>{league.map((row,i)=><div className={row[0]==="Man Utd"?"united":""} key={row[0]}><span>{i+1}</span><strong>{row[0]}</strong><b>{row[1].toFixed(1)}</b><i><em style={{width:`${row[2]}%`}}/><em style={{width:`${row[3]}%`}}/><em style={{width:`${row[4]}%`}}/><em style={{width:`${row[5]}%`}}/></i><span>{row[2]}%</span><span>{row[3]}%</span><span>{row[4]}%</span></div>)}</div>
    </section>

    <section className="dl-section scenario"><header><div><span>04 · RECRUITMENT SANDBOX</span><h2>ถ้าเปลี่ยนโครงสร้างทีม?</h2></div><p>Scenario เท่านั้น · ไม่ใช่ข่าวซื้อขายหรือการพยากรณ์</p></header>
      <div className="scenario-grid"><div><SlidersHorizontal/><h3>เพิ่มผู้เล่นวัย Prime</h3><p>ลองปรับจำนวนนักเตะใหม่ แล้วดูผลต่ออายุถ่วงน้ำหนักและสัดส่วนนาทีของทีม</p><input type="range" min="0" max="4" value={scenario} onChange={e=>setScenario(+e.target.value)}/><div className="stepper"><b>0</b><b>1</b><b>2</b><b>3</b><b>4 คน</b></div></div><div className="projection"><small>WEIGHTED SQUAD AGE</small><strong>26.4 <ArrowUpRight/> {projected.age}</strong><div><span>YOUTH <b>{projected.youth}%</b></span><span>PEAK <b>{projected.prime}%</b></span><span>EXPERIENCED <b>{projected.exp}%</b></span></div><i><em style={{width:`${projected.youth}%`}}/><em style={{width:`${projected.prime}%`}}/><em style={{width:`${projected.exp}%`}}/></i></div></div>
    </section>
    <footer className="dl-footer"><div><Activity/><b>หลักการของ GOG</b><p>ไม่สร้างความแม่นยำปลอม ทุกดัชนีต้องเผยสูตร กลุ่มเปรียบเทียบ Sample size และเวลาที่อัปเดต</p></div><div><BarChart3/><b>สถานะข้อมูล</b><p>หน้านี้เป็น Product Preview ด้วยชุดข้อมูลตัวอย่าง ก่อนเชื่อม FPL Snapshot และ Metadata ที่ตรวจสอบแล้ว</p></div><Link href="/replay"><Users/> เปิด Replay Lab <ArrowUpRight/></Link></footer>
  </Shell>
}
