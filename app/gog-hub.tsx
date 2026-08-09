"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FIXTURE_DATA_UPDATED_AT,
  MU_PREMIER_LEAGUE_FIXTURES,
  PREMIER_LEAGUE_FIXTURE_SOURCE,
  PREMIER_LEAGUE_TIME_SOURCE,
  type MuFixture,
} from "@/config/mu-fixtures";

type FixtureFilter = "all" | "home" | "away" | "confirmed";

type ChannelAnalytics = {
  connected: boolean;
  platform: string;
  handle: string;
  reason?: string;
  title?: string;
  thumbnail?: string | null;
  updatedAt: string | null;
  metrics: null | {
    subscribers: number | null;
    totalViews: number;
    totalVideos: number;
    avgViewsLast12: number;
    avgEngagementLast12: number;
  };
  recentVideos: Array<{
    id: string;
    title: string;
    publishedAt: string | null;
    views: number;
    likes: number;
    comments: number;
    url: string;
  }>;
  analysis: string[];
};

function formatFixtureDate(fixture: MuFixture) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(fixture.kickoffUtc));
}

function formatFixtureTime(fixture: MuFixture) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(fixture.kickoffUtc));
}

function compactNumber(value: number | null) {
  if (value === null) return "ซ่อนข้อมูล";
  return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function FixturesPanel() {
  const [filter, setFilter] = useState<FixtureFilter>("all");
  const [openedAt] = useState(() => Date.now());
  const fixtures = useMemo(() => MU_PREMIER_LEAGUE_FIXTURES.filter((fixture) => {
    if (filter === "home") return fixture.home === "Manchester United";
    if (filter === "away") return fixture.away === "Manchester United";
    if (filter === "confirmed") return fixture.status === "confirmed";
    return true;
  }), [filter]);
  const nextMatch = MU_PREMIER_LEAGUE_FIXTURES.find((fixture) => new Date(fixture.kickoffUtc).getTime() > openedAt) ?? MU_PREMIER_LEAGUE_FIXTURES[0];

  return (
    <section className="fixture-view" id="fixtures" aria-labelledby="fixtures-heading">
      <div className="fixture-hero">
        <div>
          <span className="eyebrow">PREMIER LEAGUE · 2026/27</span>
          <h2 id="fixtures-heading">ปฏิทินล่าฝันของยูไนเต็ด</h2>
          <p>ครบ 38 นัด พร้อมเวลาไทย สนาม และเมืองเจ้าภาพ</p>
        </div>
        <article className="next-match-card">
          <span>NEXT MATCH · MW {nextMatch.matchday}</span>
          <div><b>{nextMatch.home}</b><i>VS</i><b>{nextMatch.away}</b></div>
          <strong>{formatFixtureDate(nextMatch)} · {formatFixtureTime(nextMatch)} น. ไทย</strong>
          <small>{nextMatch.stadium} · {nextMatch.city}</small>
        </article>
      </div>

      <div className="fixture-toolbar">
        <div className="fixture-filters" aria-label="ตัวกรองโปรแกรมแข่ง">
          {([
            ["all", "ทั้งหมด 38"],
            ["home", "เหย้า"],
            ["away", "เยือน"],
            ["confirmed", "ยืนยันเวลาแล้ว"],
          ] as Array<[FixtureFilter, string]>).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="fixture-legend"><span><i className="confirmed" /> ยืนยันเวลา</span><span><i /> เวลาตั้งต้น—รอยืนยัน</span></div>
      </div>

      <div className="fixture-table-wrap">
        <table className="fixture-table">
          <thead>
            <tr><th>นัด</th><th>วันแข่งขัน</th><th>คู่แข่งขัน</th><th>เวลาไทย</th><th>สนาม</th><th>เมือง</th><th>สถานะ</th></tr>
          </thead>
          <tbody>
            {fixtures.map((fixture) => {
              const isHome = fixture.home === "Manchester United";
              return (
                <tr key={`${fixture.matchday}-${fixture.kickoffUtc}`}>
                  <td><b className="matchday">{String(fixture.matchday).padStart(2, "0")}</b></td>
                  <td><strong>{formatFixtureDate(fixture)}</strong></td>
                  <td>
                    <div className="fixture-opponents">
                      <span className={isHome ? "united" : ""}>{fixture.home}</span><i>v</i><span className={!isHome ? "united" : ""}>{fixture.away}</span>
                    </div>
                    <small>{isHome ? "เหย้า" : "เยือน"}</small>
                  </td>
                  <td><b className="thai-time">{formatFixtureTime(fixture)} น.</b><small>Asia/Bangkok</small></td>
                  <td><strong>{fixture.stadium}</strong></td>
                  <td>{fixture.city}</td>
                  <td>
                    <span className={`fixture-status ${fixture.status}`}><i />{fixture.status === "confirmed" ? "ยืนยันแล้ว" : "รอยืนยัน"}</span>
                    {fixture.broadcaster && <small>{fixture.broadcaster}</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="fixture-note">
        <p><b>หมายเหตุ:</b> เวลาแข่งขันตั้งแต่เดือนตุลาคมเป็นเวลาตั้งต้นของพรีเมียร์ลีกและอาจเปลี่ยนตามการถ่ายทอดสด ตรวจล่าสุด {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(FIXTURE_DATA_UPDATED_AT))}</p>
        <div><a href={PREMIER_LEAGUE_FIXTURE_SOURCE} target="_blank" rel="noreferrer">โปรแกรมทางการ ↗</a><a href={PREMIER_LEAGUE_TIME_SOURCE} target="_blank" rel="noreferrer">เวลาที่ประกาศแล้ว ↗</a></div>
      </div>
    </section>
  );
}

export function GogTeamPanel() {
  const [analytics, setAnalytics] = useState<ChannelAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/channel-analytics", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<ChannelAnalytics> : Promise.reject(new Error()))
      .then((payload) => active && setAnalytics(payload))
      .catch(() => active && setAnalytics({ connected: false, platform: "youtube", handle: "@FootballGeniusAG", reason: "ยังโหลดข้อมูลวิเคราะห์ไม่ได้", updatedAt: null, metrics: null, recentVideos: [], analysis: [] }))
      .finally(() => active && setAnalyticsLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <section className="gog-team-view" id="gog-team" aria-labelledby="gog-team-heading">
      <div className="gog-mission-banner">
        <div className="mission-logo-frame">
          {/* The supplied GOG identity is used as-is. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gog-logo-dark.png" alt="GOG Genius on the Ground ภารกิจบุกถิ่นผี" />
        </div>
        <div className="mission-copy">
          <span className="eyebrow">THE PEOPLE BEHIND GOG</span>
          <h2 id="gog-team-heading">GENIUS ON THE GROUND<br /><em>| ภารกิจบุกถิ่นผี</em></h2>
          <p>สามแรง หนึ่งภารกิจ—เปลี่ยนข่าวแมนเชสเตอร์ ยูไนเต็ดให้เป็นคอนเทนต์ที่แฟนบอลไทยเข้าใจ สนุก และตรวจสอบที่มาได้</p>
        </div>
      </div>

      <div className="creator-grid">
        <article className="creator-card creator-yo">
          <span className="creator-number">01</span>
          <div><span className="eyebrow">GOG CREATOR</span><h3>โยโย่</h3><strong>ธีรัตน์ ภิรมย์สวัสดิ์</strong></div>
          <div className="creator-links">
            <a href="https://www.tiktok.com/@yo_theerat" target="_blank" rel="noreferrer"><span>TT</span>TikTok @yo_theerat<b>↗</b></a>
            <a href="https://www.instagram.com/yo_theerat/" target="_blank" rel="noreferrer"><span>IG</span>Instagram @yo_theerat<b>↗</b></a>
          </div>
        </article>
        <article className="creator-card creator-aum">
          <span className="creator-number">02</span>
          <div><span className="eyebrow">GOG CREATOR</span><h3>อั้ม</h3><strong>ภัทรเศรษฐ์ เรืองรัตนะกูล</strong></div>
          <div className="creator-links">
            <a href="https://www.youtube.com/@FootballGeniusAG" target="_blank" rel="noreferrer"><span>YT</span>YouTube @FootballGeniusAG<b>↗</b></a>
            <a href="https://www.facebook.com/footballgeniusth/" target="_blank" rel="noreferrer"><span>FB</span>Facebook Football Genius<b>↗</b></a>
            <a href="https://www.tiktok.com/@footballgenius_official" target="_blank" rel="noreferrer"><span>TT</span>TikTok @footballgenius_official<b>↗</b></a>
          </div>
        </article>
        <article className="creator-card creator-duke">
          <span className="creator-number">03</span>
          <div><span className="eyebrow">AI ENGINEERING &amp; PROJECT LEAD</span><h3>อ.ดุ๊ก</h3><strong>อ.ธาริน กุลชล</strong></div>
          <div className="creator-role-note">
            <p>ออกแบบและคุมระบบเบื้องหลังทั้งหมดของ GOG NEWSROOM ตั้งแต่สายข่าวอัตโนมัติ การตรวจแหล่งที่มา ไปจนถึงการนำ AI มาเรียบเรียงเป็นภาษาไทย</p>
          </div>
        </article>
      </div>

      <section className="channel-intelligence" aria-labelledby="channel-intelligence-heading">
        <div className="channel-heading">
          <div><span className="eyebrow">CHANNEL INTELLIGENCE API</span><h2 id="channel-intelligence-heading">วิเคราะห์ช่อง GOG จากข้อมูลจริง</h2><p>อ่านเฉพาะสถิติสาธารณะของ YouTube ผ่าน YouTube Data API</p></div>
          <span className={`api-status ${analytics?.connected ? "connected" : ""}`}><i />{analyticsLoading ? "กำลังตรวจ API" : analytics?.connected ? "เชื่อมต่อแล้ว" : "พร้อมเชื่อมต่อ"}</span>
        </div>

        {analyticsLoading ? (
          <div className="analytics-loading"><i /><i /><i /><i /></div>
        ) : analytics?.connected && analytics.metrics ? (
          <>
            <div className="metric-grid">
              <article><span>ผู้ติดตาม</span><strong>{compactNumber(analytics.metrics.subscribers)}</strong><small>YouTube</small></article>
              <article><span>ยอดดูรวม</span><strong>{compactNumber(analytics.metrics.totalViews)}</strong><small>ทุกวิดีโอ</small></article>
              <article><span>จำนวนวิดีโอ</span><strong>{compactNumber(analytics.metrics.totalVideos)}</strong><small>ในช่อง</small></article>
              <article><span>เฉลี่ย 12 คลิปล่าสุด</span><strong>{compactNumber(analytics.metrics.avgViewsLast12)}</strong><small>วิวต่อคลิป</small></article>
              <article><span>Engagement</span><strong>{analytics.metrics.avgEngagementLast12}%</strong><small>ไลก์+คอมเมนต์ / วิว</small></article>
            </div>
            <div className="analytics-detail-grid">
              <div className="analysis-recommendations"><h3>สิ่งที่ข้อมูลบอก</h3>{analytics.analysis.map((item, index) => <p key={item}><span>0{index + 1}</span>{item}</p>)}</div>
              <div className="recent-video-list"><h3>คลิปล่าสุดในชุดวิเคราะห์</h3>{analytics.recentVideos.slice(0, 4).map((video) => <a key={video.id} href={video.url} target="_blank" rel="noreferrer"><span>{compactNumber(video.views)} วิว</span><b>{video.title}</b><em>↗</em></a>)}</div>
            </div>
          </>
        ) : (
          <div className="analytics-connect-state">
            <span className="analytics-mark">API</span>
            <div><h3>ระบบวิเคราะห์พร้อมแล้ว—เหลือเชื่อมกุญแจ YouTube</h3><p>เมื่อเพิ่ม <b>YOUTUBE_API_KEY</b> เว็บจะแสดงผู้ติดตาม ยอดดูรวม ค่าเฉลี่ย 12 คลิปล่าสุด อัตรามีส่วนร่วม และคลิปที่ทำผลงานดีที่สุด โดยไม่สร้างตัวเลขขึ้นเอง</p><small>{analytics?.reason}</small></div>
            <a href="https://developers.google.com/youtube/v3/getting-started" target="_blank" rel="noreferrer">คู่มือ YouTube API ↗</a>
          </div>
        )}

        <div className="platform-scope">
          <span><b>YouTube</b> วิเคราะห์อัตโนมัติเมื่อเชื่อม API</span>
          <span><b>TikTok / Instagram / Facebook</b> ลิงก์ช่องพร้อมแล้ว—การอ่าน Insights ต้องใช้สิทธิ์เจ้าของบัญชีของแต่ละแพลตฟอร์ม</span>
        </div>
      </section>
    </section>
  );
}
