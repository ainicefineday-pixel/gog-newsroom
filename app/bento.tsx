"use client";

// GOG HUB — การ์ดขนาดไม่เท่ากันแบบ Bento
// ---------------------------------------------------------------------------
// โครงเดียวกับ BentoGrid/BentoCard ของ Magic UI (Icon · name · description ·
// cta · className · background) แต่เขียนด้วย CSS ของโปรเจกต์เอง
//
// ตั้งใจไม่ไปแทนแถบนำทางเดิม เพราะแถบนั้นใช้อยู่ทุกหน้าและต้องกดได้เร็ว
// ส่วนนี้อยู่ท้ายหน้าข่าว เป็นจังหวะ "อ่านข่าวจบแล้วไปไหนต่อ"
//
// กติกาของพื้นหลังการ์ด: ต้องเป็นข้อมูลจริงเท่านั้น
// ดึงไม่ได้ก็ปล่อยว่างแล้วเหลือแค่คำอธิบาย ไม่ใส่ตัวอย่างปลอมให้ดูสวย
// เพราะการ์ดที่โชว์ "นัดถัดไป" ผิดนัด แย่กว่าการ์ดที่ไม่โชว์อะไรเลย

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays, Handshake, MapPin, Newspaper, Plane, ScrollText, Trophy, Users,
} from "lucide-react";
import { GOG_STADIUMS } from "@/config/gog-stadiums";
import { GlowingEffect } from "@/app/glow";
import type { Story } from "@/lib/types";

export function BentoGrid({ children }: { children: ReactNode }) {
  return <div className="bento-grid">{children}</div>;
}

export function BentoCard({
  Icon, name, description, cta, onClick, className = "", background,
}: {
  Icon: typeof Newspaper;
  name: string;
  description: string;
  cta: string;
  onClick: () => void;
  className?: string;
  background?: ReactNode;
}) {
  return (
    <button type="button" className={`bento-card ${className}`.trim()} onClick={onClick}>
      {/* พื้นหลังเป็นภาพประกอบ ห้ามรับโฟกัสหรือถูกอ่านซ้ำ ปุ่มทั้งใบคือตัวกด */}
      <GlowingEffect />
      {background && <div className="bento-bg" aria-hidden="true">{background}</div>}
      <div className="bento-body">
        <Icon size={19} aria-hidden="true" />
        <b>{name}</b>
        <p>{description}</p>
        <span className="bento-cta">{cta} →</span>
      </div>
    </button>
  );
}

type FixtureLite = {
  id: string;
  kickoffUtc: string;
  kickoffTimeAnnounced: boolean;
  home: { nameTh: string };
  away: { nameTh: string };
  venue: { name: string } | null;
};

const DAY_MS = 86_400_000;

export function GogHubBento({ stories, verifiedCount, onNavigate }: {
  stories: Story[];
  verifiedCount: number;
  onNavigate: (view: "fixtures" | "matchcenter" | "trip" | "partners" | "map" | "tactics" | "team") => void;
}) {
  const [fixtures, setFixtures] = useState<FixtureLite[] | null>(null);
  const [partnerCount, setPartnerCount] = useState<number | null>(null);
  // อ่านเวลาหลัง hydrate เท่านั้น ไม่งั้นฝั่งเซิร์ฟเวอร์กับเบราว์เซอร์ได้คนละค่า
  const [now, setNow] = useState(0);

  useEffect(() => {
    window.queueMicrotask(() => setNow(Date.now()));
    let alive = true;
    fetch("/api/football/fixtures")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { fixtures?: FixtureLite[] } | null) => {
        if (alive) setFixtures(payload?.fixtures ?? []);
      })
      .catch(() => { if (alive) setFixtures([]); });
    fetch("/api/partners")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { partners?: unknown[] } | null) => {
        if (alive) setPartnerCount(payload?.partners?.length ?? 0);
      })
      .catch(() => { if (alive) setPartnerCount(null); });
    return () => { alive = false; };
  }, []);

  /** นัดถัดไปที่ยังไม่เตะ — null เมื่อยังโหลดไม่เสร็จหรือหมดฤดูกาลแล้ว */
  const nextFixture = useMemo(() => {
    if (!fixtures || now === 0) return null;
    return fixtures
      .filter((fixture) => new Date(fixture.kickoffUtc).getTime() > now)
      .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0] ?? null;
  }, [fixtures, now]);

  const daysToNext = nextFixture && now
    ? Math.max(0, Math.ceil((new Date(nextFixture.kickoffUtc).getTime() - now) / DAY_MS))
    : null;

  const headlines = useMemo(
    () => stories.slice(0, 8).map((story) => story.titleTh || story.titleEn).filter(Boolean),
    [stories],
  );

  return (
    <section className="bento-section" aria-labelledby="bento-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">GOG HUB</span>
          <h2 id="bento-heading">อ่านข่าวจบแล้ว ไปต่อที่ไหนดี</h2>
        </div>
        <p>ทุกเครื่องมือของ GOG ต่อกันหมด — จากข่าวไปถึงตั๋วเครื่องบิน</p>
      </div>

      <BentoGrid>
        <BentoCard
          Icon={Trophy}
          name="Match Center"
          description={nextFixture
            ? `นัดถัดไป ${nextFixture.home.nameTh} พบ ${nextFixture.away.nameTh}${daysToNext !== null ? ` · อีก ${daysToNext} วัน` : ""}`
            : "โปรแกรมทั้งลีก สถิติ ตารางคะแนน และผลที่แปลว่าอะไร"}
          cta="เปิด Match Center"
          onClick={() => onNavigate("matchcenter")}
          className="wide"
          background={nextFixture ? (
            <div className="bento-next-match">
              <span>{nextFixture.venue?.name ?? "รอประกาศสนาม"}</span>
              <b>{nextFixture.home.nameTh}</b>
              <em>พบ</em>
              <b>{nextFixture.away.nameTh}</b>
              {!nextFixture.kickoffTimeAnnounced && <span className="bento-tbd">ยังไม่ประกาศเวลาเตะ</span>}
            </div>
          ) : null}
        />

        <BentoCard
          Icon={Newspaper}
          name="คลังข่าวทั้งหมด"
          description={`${stories.length} ข่าวในระบบ · ยืนยันข้ามแหล่งแล้ว ${verifiedCount} ข่าว`}
          cta="เลื่อนขึ้นไปอ่าน"
          onClick={() => document.getElementById("news")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="tall"
          background={headlines.length > 0 ? (
            <div className="bento-marquee">
              {/* ทำสองชุดต่อกันเพื่อให้เลื่อนวนไม่มีรอยต่อ */}
              {[0, 1].map((copy) => (
                <div className="bento-marquee-track" key={copy}>
                  {headlines.map((headline, index) => (
                    <span key={`${copy}-${index}`}>{headline}</span>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        />

        <BentoCard
          Icon={Plane}
          name="วางแผนทริป"
          description="เลือกแมตช์แล้วได้แผนทั้งทริป ตั๋ว ที่พัก วีซ่า และวันลาที่ต้องใช้"
          cta="เริ่มวางแผน"
          onClick={() => onNavigate("trip")}
        />

        <BentoCard
          Icon={CalendarDays}
          name="โปรแกรมพรีเมียร์ลีก"
          description={fixtures && fixtures.length > 0
            ? `${fixtures.length} นัดตลอดฤดูกาล พร้อมเวลาไทย`
            : "โปรแกรมทั้งฤดูกาล แปลงเป็นเวลาไทยให้แล้ว"}
          cta="ดูโปรแกรม"
          onClick={() => onNavigate("fixtures")}
        />

        <BentoCard
          Icon={Handshake}
          name="เครือข่าย GOG"
          description={partnerCount !== null && partnerCount > 0
            ? `คนไทยในอังกฤษ ${partnerCount} รายที่ผ่านการตรวจแล้ว`
            : "คนไทยในอังกฤษที่รับงานรถ ที่พัก ร้านอาหาร และถ่ายภาพ"}
          cta="ดูเครือข่าย"
          onClick={() => onNavigate("partners")}
        />

        <BentoCard
          Icon={MapPin}
          name="แผนที่สนาม"
          description={`คู่มือ ${GOG_STADIUMS.length} สนามที่ทีมงานเขียนเอง — ลงสถานีไหน เดินกี่นาที`}
          cta="เปิดแผนที่"
          onClick={() => onNavigate("map")}
          className="wide"
          background={(
            <div className="bento-stadiums">
              {GOG_STADIUMS.slice(0, 12).map((stadium) => (
                <span key={stadium.stadium}>{stadium.stadium}</span>
              ))}
            </div>
          )}
        />

        <BentoCard
          Icon={ScrollText}
          name="แผนการเล่น"
          description="กระดานแทคติกที่ลากตัวผู้เล่นได้ ตั้งต้นจากตัวจริงชุดล่าสุด"
          cta="เปิดกระดาน"
          onClick={() => onNavigate("tactics")}
        />

        <BentoCard
          Icon={Users}
          name="ทีม GOG"
          description="คนทำคอนเทนต์เบื้องหลัง และตัวเลขช่องที่อัปเดตอัตโนมัติ"
          cta="รู้จักทีม"
          onClick={() => onNavigate("team")}
        />
      </BentoGrid>
    </section>
  );
}
