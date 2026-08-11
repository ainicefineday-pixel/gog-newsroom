"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Beer,
  BedDouble,
  Building2,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  CloudRain,
  CloudSun,
  Coffee,
  Coins,
  FileText,
  Handshake,
  Hotel,
  Info,
  Landmark,
  MapPin,
  Navigation,
  Plane,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Stamp,
  Star,
  Ticket,
  TriangleAlert,
  Trophy,
  UtensilsCrossed,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { listPlannableFixtures, recommendTripDates, hotelNights, gogToPlannable, type PlannableFixture } from "@/services/football/fixtures";
import { ARRIVAL_AIRPORTS, BANGKOK, arrivalWarning, listFlights, type FlightSort } from "@/services/flights";
import { defaultHotel, listHotels } from "@/services/hotels";
import { GBP_TO_THB, estimateTrip, formatMoney, railDayTripThb } from "@/services/pricing";
import { getStadiumTravelPlan, totalTravelMinutes } from "@/config/stadium-travel";
import { buildItinerary, detectConflicts, type ItineraryDay } from "@/services/itinerary";
import { pilgrimageIn, PLACES } from "@/services/places";
import { recommendFixture, sortByRecommendation } from "@/services/football/recommendation";
import type { ItemIcon } from "@/services/itinerary";
import { PARTNER_KIND_LABEL, fromPrice, rankPartners } from "@/services/partners";
import type { Partner, PartnerKind } from "@/lib/server/partners";
import {
  EMPTY_VISA,
  EVISA_NOTE,
  EVISA_STEPS,
  FEES_UPDATED,
  GOG_VISA_PACKAGES,
  IDP_ADVICE,
  IDP_DOCUMENTS,
  IDP_OPTIONS,
  IDP_WHERE,
  LODGE_OPTIONS,
  PASSPORT_DOCUMENTS,
  PASSPORT_OPTIONS,
  PASSPORT_WHERE,
  VISA_CENTRES,
  VISA_DOCUMENTS,
  VISA_LINKS,
  VISA_STEPS,
  VISA_TYPES,
  buildVisaPlan,
  hasVisa,
  lodgePriceThb,
  needsPassportWork,
  packagePricePerPerson,
  visaBreakdown,
  visaCostLines,

  type PassportStatus,
  type VisaSelection,
} from "@/services/visa";
import { leaveDaysFor, thaiHoliday, isThaiWeekend } from "@/config/thai-holidays";
import type { MatchWeather } from "@/services/weather";
import { buildCompanionView, inMinutesTh, type CompanionAlert } from "@/services/intelligence/companion";
import { BackgroundGradient } from "@/app/glow";
import { formatThb } from "@/services/pricing";
import { FLIGHT_OPTIONS } from "@/services/flights";
import { HOTEL_OPTIONS } from "@/services/hotels";
import { BUDGET_LABELS, type BudgetStyle, type DestinationCity, type TripLength } from "@/services/trip/types";

const BUDGET_ORDER: BudgetStyle[] = ["saver", "comfort", "premium"];

// ไอคอนเส้นแทน emoji — ชุดเดียวกับ nav bar ของ people-space
const ITEM_ICON: Record<ItemIcon, typeof Plane> = {
  plane: Plane,
  hotel: BedDouble,
  food: UtensilsCrossed,
  coffee: Coffee,
  stadium: Trophy,
  museum: Building2,
  transport: Bus,
  shop: ShoppingBag,
  pub: Beer,
  landmark: Landmark,
  ticket: Ticket,
  clock: Clock,
};

// รายการในแผนเที่ยวประเภทไหน ให้พาร์ตเนอร์ประเภทไหนรับงานได้ (STEP 42)
// ไอคอนที่ไม่อยู่ในตารางนี้ (เช่น พิพิธภัณฑ์ ร้านค้า) ไม่ขึ้นปุ่ม GOG Network
const ITEM_PARTNER_KIND: Partial<Record<ItemIcon, PartnerKind>> = {
  plane: "driver",
  transport: "driver",
  food: "restaurant",
  coffee: "restaurant",
  pub: "restaurant",
  hotel: "stay",
};

function thaiDate(ymd: string) {
  if (!ymd) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${ymd}T00:00:00Z`));
}

function ukKickoff(fixture: PlannableFixture) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(fixture.kickoffUtc));
}

function thaiKickoff(fixture: PlannableFixture) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(fixture.kickoffUtc));
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

function addDays(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * รายชื่อพาร์ตเนอร์ที่รับงานของรายการนี้ได้ + ฟอร์มส่งคำขอจอง
 * โหมดไดเรกทอรี — GOG ส่งต่อคำขอให้เท่านั้น ไม่รับเงินแทนผู้ให้บริการ
 */
function GogPartnerPicker({ partners, kind, serviceDate, travellers, tripId, onClose }: {
  partners: Partner[];
  kind: PartnerKind;
  serviceDate: string;
  travellers: number;
  tripId: string;
  onClose: () => void;
}) {
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const partner = partners.find((item) => item.id === partnerId) ?? partners[0] ?? null;
  const ready = Boolean(partner && name.trim() && contact.trim() && serviceDate);

  const send = async () => {
    if (!partner || !ready) return;
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partnerId: partner.id,
          serviceId: partner.services[0]?.id ?? "",
          tripId,
          travellerName: name.trim(),
          travellerContact: contact.trim(),
          serviceDate,
          pax: travellers,
          message: `ขอผ่านแผนเที่ยว GOG · ${PARTNER_KIND_LABEL[kind]} วันที่ ${serviceDate}`,
        }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "ส่งคำขอไม่สำเร็จ");
      setStatus("done");
    } catch (issue) {
      setStatus("idle");
      setError(issue instanceof Error ? issue.message : "ส่งคำขอไม่สำเร็จ");
    }
  };

  return (
    <div className="gog-picker">
      <header>
        <strong>GOG NETWORK · {PARTNER_KIND_LABEL[kind]}</strong>
        <button type="button" onClick={onClose} aria-label="ปิด"><X size={13} aria-hidden="true" /></button>
      </header>

      {partners.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`gog-option ${item.id === partner?.id ? "active" : ""}`}
          onClick={() => setPartnerId(item.id)}
        >
          <span className="gog-option-main">
            <strong>{item.displayName}</strong>
            <small>
              {item.services[0]?.title ?? PARTNER_KIND_LABEL[item.kind]}
              {item.vehicle ? ` · ${item.vehicle.make} ${item.vehicle.model} ${item.vehicle.seats} ที่นั่ง` : ""}
              {item.reviewCount > 0 ? ` · ${item.rating.toFixed(1)}/5 (${item.reviewCount})` : ""}
            </small>
          </span>
          {fromPrice(item) > 0 && <span className="gog-option-price">เริ่ม {formatThb(fromPrice(item))}</span>}
        </button>
      ))}

      {status === "done" ? (
        <p className="gog-picker-done">
          ส่งคำขอให้ {partner?.displayName} แล้ว — ผู้ให้บริการจะติดต่อกลับตามช่องทางที่ให้ไว้
        </p>
      ) : (
        <>
          <div className="gog-book-form">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="ชื่อผู้เดินทาง" />
            <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="LINE ID หรือเบอร์โทร" />
            <button type="button" onClick={send} disabled={!ready || status === "sending"}>
              {status === "sending" ? "กำลังส่ง…" : "ส่งคำขอ"}
            </button>
          </div>
          {error && <p className="gog-picker-error">{error}</p>}
          <p className="gog-picker-note">
            ส่งคำขอสำหรับวันที่ {thaiDate(serviceDate)} · {travellers} คน — GOG เป็นไดเรกทอรี
            ตกลงราคาและชำระเงินกับผู้ให้บริการโดยตรง
          </p>
        </>
      )}
    </div>
  );
}

/**
 * ปฏิทินช่วงเดินทาง — ไฮไลต์วันที่ทริปกินไปทั้งช่วง พร้อมมาร์กวันแข่ง
 * วันหยุดไทย และวันที่ต้องยื่นใบลา ให้เห็นภาพว่าลากี่วันจริง (STEP 45)
 */
function TripCalendar({ departDate, returnDate, matchDate, lodgeBy }: {
  departDate: string;
  returnDate: string;
  matchDate: string | null;
  lodgeBy: string | null;
}) {
  const months = useMemo(() => {
    if (!departDate || !returnDate) return [];
    // แสดงเฉพาะเดือนที่ทริปพาดผ่าน — ทริปยาวสุด 10 วันจึงไม่เกิน 2 เดือน
    const keys: string[] = [];
    const cursor = new Date(`${departDate.slice(0, 8)}01T00:00:00Z`);
    const end = new Date(`${returnDate.slice(0, 8)}01T00:00:00Z`);
    while (cursor <= end && keys.length < 3) {
      keys.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
  }, [departDate, returnDate]);

  if (!months.length) return null;

  return (
    <div className="trip-calendar">
      {months.map((key) => {
        const first = new Date(`${key}-01T00:00:00Z`);
        const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
        // ปฏิทินเริ่มวันจันทร์ตามที่คนไทยคุ้น — getUTCDay() คืน 0 = อาทิตย์
        const lead = (first.getUTCDay() + 6) % 7;
        const label = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "long", year: "numeric" }).format(first);

        return (
          <div className="trip-calendar-month" key={key}>
            <strong>{label}</strong>
            <div className="trip-calendar-grid">
              {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((name) => (
                <span className="trip-calendar-head" key={name}>{name}</span>
              ))}
              {Array.from({ length: lead }, (_, index) => <span key={`lead-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const ymd = `${key}-${String(index + 1).padStart(2, "0")}`;
                const inTrip = ymd >= departDate && ymd <= returnDate;
                const holiday = thaiHoliday(ymd);
                const weekend = isThaiWeekend(ymd);
                const needLeave = inTrip && !weekend && !holiday;
                const classes = [
                  "trip-calendar-day",
                  inTrip ? "in-trip" : "",
                  ymd === departDate ? "start" : "",
                  ymd === returnDate ? "end" : "",
                  ymd === matchDate ? "match" : "",
                  ymd === lodgeBy ? "lodge" : "",
                  holiday ? "holiday" : "",
                  weekend ? "weekend" : "",
                  needLeave ? "leave" : "",
                ].filter(Boolean).join(" ");
                const title = [
                  ymd === matchDate ? "วันแข่ง" : "",
                  ymd === lodgeBy ? "ควรยื่นวีซ่าภายในวันนี้" : "",
                  holiday?.name ?? "",
                  needLeave ? "ต้องลางาน" : "",
                ].filter(Boolean).join(" · ");
                return (
                  <span className={classes} key={ymd} title={title || undefined}>
                    {index + 1}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <ul className="trip-calendar-legend">
        <li><i className="dot trip" /> ช่วงเดินทาง</li>
        <li><i className="dot match" /> วันแข่ง</li>
        <li><i className="dot holiday" /> วันหยุดไทย</li>
        <li><i className="dot leave" /> ต้องลางาน</li>
        <li><i className="dot lodge" /> เส้นตายยื่นวีซ่า</li>
      </ul>
    </div>
  );
}

// ── เอกสารกำหนดการเดินทาง A4 สำหรับยื่นวีซ่า (STEP 78) ──────────────────
// สถานทูตอังกฤษขอ "กำหนดการเดินทาง" ประกอบใบสมัคร คนไทยส่วนใหญ่ต้องนั่งพิมพ์
// ตารางเองใน Word ทั้งที่ระบบมีข้อมูลครบอยู่แล้ว หน้านี้จัดหน้า A4 สองภาษาให้
// กด Ctrl+P แล้วเลือก Save as PDF ได้เลย
//
// สำคัญมาก: เอกสารนี้ต้องไม่ทำตัวเป็นหลักฐานการจอง
// ราคาทุกตัวเป็นการประมาณการ และเที่ยวบิน/โรงแรมเป็นแผนที่ตั้งใจจะจอง
// ยังไม่ใช่ booking ที่ยืนยันแล้ว ถ้าปล่อยให้ดูเหมือนหลักฐานการจอง
// = ยื่นเอกสารเท็จต่อหน่วยงานรัฐ ซึ่งทำให้ผู้ใช้ถูกปฏิเสธวีซ่าและติดแบล็กลิสต์
// จึงเขียนกำกับไว้ชัดทั้งสองภาษาทั้งหัวและท้ายเอกสาร

const DAY_THEME_EN: Record<string, string> = {
  takeoff: "Departure from Bangkok",
  arrival: "Arrival in the UK",
  football: "Football culture day",
  matchday: "Match day",
  city: "City exploration",
  daytrip: "Day trip",
  departure: "Return to Bangkok",
};

function isoDateEn(ymd: string) {
  if (!ymd) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(`${ymd}T00:00:00Z`));
}

function VisaTripDocument({ itinerary, fixture, city, departDate, returnDate, travellers, perPerson, flight, hotel }: {
  itinerary: ItineraryDay[];
  fixture: { home: string; away: string; kickoffUtc: string; stadium: string } | null;
  city: string;
  departDate: string;
  returnDate: string;
  travellers: number;
  perPerson: number;
  flight: { airline: string; route: string } | null;
  hotel: { name: string; area: string } | null;
}) {
  const [applicant, setApplicant] = useState("");
  const [passport, setPassport] = useState("");
  const [open, setOpen] = useState(false);

  if (itinerary.length === 0) return null;

  return (
    <div className="visa-doc-block">
      <header>
        <div>
          <span className="eyebrow">VISA SUPPORTING DOCUMENT</span>
          <strong><FileText size={15} aria-hidden="true" /> เอกสารกำหนดการเดินทาง A4 (ไทย–อังกฤษ)</strong>
          <small>
            สำหรับแนบกับใบสมัครวีซ่าอังกฤษ · กรอกชื่อตามพาสปอร์ตแล้วกดพิมพ์
            เลือก &ldquo;Save as PDF&rdquo; ในหน้าต่างพิมพ์ได้เลย
          </small>
        </div>
        <button type="button" className="visa-doc-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? "ซ่อน" : "เตรียมเอกสาร"}
        </button>
      </header>

      {open && (
        <>
          <div className="visa-doc-form">
            <label>
              <span>ชื่อ-นามสกุล ตามพาสปอร์ต (อังกฤษ)</span>
              <input type="text" value={applicant} maxLength={120} placeholder="MR. THEERAT ..."
                onChange={(event) => setApplicant(event.target.value)} />
            </label>
            <label>
              <span>เลขพาสปอร์ต (ถ้ามี)</span>
              <input type="text" value={passport} maxLength={20} placeholder="AA1234567"
                onChange={(event) => setPassport(event.target.value.toUpperCase())} />
            </label>
          </div>
          <p className="visa-doc-warn">
            เอกสารนี้เป็น <b>กำหนดการเดินทางที่วางแผนไว้</b> ไม่ใช่หลักฐานการจอง
            ราคาทุกรายการเป็นการประมาณการ ต้องแนบใบจองตั๋วเครื่องบินและที่พักตัวจริงแยกต่างหาก
          </p>
          <button type="button" className="visa-doc-print" onClick={() => window.print()}>
            พิมพ์ / บันทึกเป็น PDF
          </button>
        </>
      )}

      {/* หน้ากระดาษจริง — ซ่อนบนจอ แสดงเฉพาะตอนพิมพ์ */}
      <article className="visa-doc" lang="th">
        <header className="visa-doc-head">
          <div>
            <h1>กำหนดการเดินทาง · TRAVEL ITINERARY</h1>
            <p>สหราชอาณาจักร · United Kingdom</p>
          </div>
          <div className="visa-doc-meta">
            <span>ออกเอกสาร / Issued</span>
            <b>{isoDateEn(new Date().toISOString().slice(0, 10))}</b>
          </div>
        </header>

        <p className="visa-doc-notice">
          <b>PLANNED ITINERARY — NOT A BOOKING CONFIRMATION.</b> All costs shown are estimates.
          Flight and accommodation entries describe the intended arrangements; confirmed reservations
          are submitted separately.
          <br />
          <b>เอกสารนี้เป็นกำหนดการที่วางแผนไว้ ไม่ใช่หลักฐานการจอง</b> ราคาทั้งหมดเป็นการประมาณการ
          ใบจองตัวจริงแนบแยกต่างหาก
        </p>

        <section className="visa-doc-grid">
          <div><dt>ผู้เดินทาง / Applicant</dt><dd>{applicant || "—"}</dd></div>
          <div><dt>เลขพาสปอร์ต / Passport no.</dt><dd>{passport || "—"}</dd></div>
          <div><dt>จำนวนผู้เดินทาง / Travellers</dt><dd>{travellers}</dd></div>
          <div><dt>วัตถุประสงค์ / Purpose of visit</dt><dd>ท่องเที่ยวและเข้าชมการแข่งขันฟุตบอล · Tourism and attending a football match</dd></div>
          <div><dt>ออกเดินทาง / Departure</dt><dd>{isoDateEn(departDate)}</dd></div>
          <div><dt>เดินทางกลับ / Return</dt><dd>{isoDateEn(returnDate)}</dd></div>
          <div><dt>ระยะเวลา / Duration</dt><dd>{itinerary.length} วัน / days</dd></div>
          <div><dt>เมืองหลัก / Main city</dt><dd>{city}, United Kingdom</dd></div>
        </section>

        <section className="visa-doc-section">
          <h2>การเดินทางและที่พัก · Travel and accommodation</h2>
          <table>
            <tbody>
              <tr>
                <th>เที่ยวบิน / Flight</th>
                <td>{flight ? `${flight.airline} · ${flight.route}` : "ยังไม่ระบุ / to be confirmed"}</td>
              </tr>
              <tr>
                <th>ที่พัก / Accommodation</th>
                <td>{hotel ? `${hotel.name} · ${hotel.area}, ${city}` : "ยังไม่ระบุ / to be confirmed"}</td>
              </tr>
              {fixture && (
                <tr>
                  <th>การแข่งขัน / Match</th>
                  <td>
                    {fixture.home} v {fixture.away} · {fixture.stadium}
                    <br />{isoDateEn(fixture.kickoffUtc.slice(0, 10))}
                  </td>
                </tr>
              )}
              <tr>
                <th>ค่าใช้จ่ายโดยประมาณ / Estimated cost</th>
                <td>{perPerson.toLocaleString("th-TH")} THB ต่อคน / per person (estimate)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="visa-doc-section">
          <h2>กำหนดการรายวัน · Day-by-day itinerary</h2>
          {itinerary.map((day) => (
            <div key={day.date} className="visa-doc-day">
              <h3>
                <span>DAY {day.dayNumber}</span>
                {isoDateEn(day.date)} — {day.title} / {DAY_THEME_EN[day.theme] ?? day.theme}
              </h3>
              <ul>
                {day.items.map((item, index) => (
                  <li key={`${item.time}-${index}`}>
                    <b>{item.time}</b>
                    <span>{item.title}{item.area ? ` · ${item.area}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <footer className="visa-doc-foot">
          จัดทำโดย GOG NEWSROOM · geniusontheground · เอกสารประกอบการยื่นวีซ่า ไม่ใช่หลักฐานการจอง
          <br />
          Prepared by GOG NEWSROOM as a supporting itinerary. Not a booking confirmation.
        </footer>
      </article>
    </div>
  );
}

// ── โหมดเพื่อนคู่ใจวันแข่ง (STEP 77) ────────────────────────────────────
// ตอนยืนอยู่กลางแมนเชสเตอร์ ไม่มีใครอยากเลื่อนดูแผนทั้ง 5 วัน
// อยากรู้แค่ "ตอนนี้ควรทำอะไร แล้วอีกกี่นาทีต้องออก"

const ALERT_ICON: Record<CompanionAlert["level"], typeof Clock> = {
  urgent: TriangleAlert,
  warn: CloudRain,
  info: Info,
};

/**
 * เวลาอังกฤษปัจจุบัน — ต้องใช้ Intl เท่านั้น
 * Europe/London เปลี่ยนเวลาปีละสองครั้ง (GMT ฤดูหนาว BST ฤดูร้อน)
 * ถ้าบวกลบชั่วโมงเองจะผิดทุกครั้งที่ข้ามช่วง DST ซึ่งกินเวลาครึ่งฤดูกาลพอดี
 */
function ukNow(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    clock: `${get("hour")}:${get("minute")}`,
  };
}

function MatchdayCompanion({ itinerary, matchDate, kickoffUtc, venueName, weather }: {
  itinerary: ItineraryDay[];
  matchDate: string | null;
  kickoffUtc: string | null;
  venueName: string | null;
  weather: MatchWeather | null;
}) {
  // เวลาปัจจุบันอ่านหลัง hydrate เท่านั้น ไม่งั้น server กับ client เรนเดอร์คนละเวลา
  const [at, setAt] = useState<Date | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    window.queueMicrotask(() => setAt(new Date()));
    const timer = window.setInterval(() => setAt(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // โหมดพรีวิว: ให้ดูได้ว่าวันแข่งหน้าตาเป็นยังไง ทั้งที่ยังไม่ถึงวัน
  // ไม่ใช่ของปลอม — เป็นแผนวันแข่งจริง แค่สมมติว่าตอนนี้ 9 โมงเช้าอังกฤษ
  const effective = useMemo(() => {
    if (preview && matchDate) return { date: matchDate, minutes: 9 * 60, clock: "09:00" };
    return at ? ukNow(at) : null;
  }, [preview, matchDate, at]);

  const view = useMemo(() => (effective ? buildCompanionView({
    itinerary,
    ukDate: effective.date,
    ukMinutes: effective.minutes,
    matchDate: matchDate ?? "",
    kickoffUtc, venueName, weather,
  }) : null), [itinerary, effective, matchDate, kickoffUtc, venueName, weather]);

  if (itinerary.length === 0) return null;

  return (
    <div className={`companion ${view?.status ?? "loading"}`}>
      <header>
        <div>
          <span className="eyebrow">MATCHDAY COMPANION</span>
          <strong><Navigation size={15} aria-hidden="true" /> ตอนนี้ควรทำอะไร</strong>
          <small>
            {effective
              ? `เวลาอังกฤษ ${effective.clock} · ${thaiDate(effective.date)}${preview ? " (พรีวิววันแข่ง)" : ""}`
              : "กำลังอ่านเวลา…"}
          </small>
        </div>
        {matchDate && (
          <button type="button" className="companion-preview" onClick={() => setPreview((value) => !value)}>
            {preview ? "กลับไปเวลาจริง" : "พรีวิววันแข่ง"}
          </button>
        )}
      </header>

      {view && (
        <>
          {view.alerts.length > 0 && (
            <ul className="companion-alerts">
              {view.alerts.map((alert, index) => {
                const AlertIcon = ALERT_ICON[alert.level];
                return (
                  <li key={`${alert.level}-${index}`} className={alert.level}>
                    <AlertIcon size={13} aria-hidden="true" />
                    <span>{alert.text}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {(view.now || view.next) && (
            <div className="companion-cards">
              <article className="companion-now">
                <span>ตอนนี้</span>
                {view.now ? (
                  <>
                    <b>{view.now.title}</b>
                    <p>{view.now.detail}</p>
                    {view.now.area && <small>{view.now.area}</small>}
                  </>
                ) : (
                  <b className="companion-idle">ช่วงว่าง — เดินเล่นได้ตามสบาย</b>
                )}
              </article>
              {view.next && (
                <article className="companion-next">
                  <span>ถัดไป · {inMinutesTh(view.next.inMinutes)}</span>
                  <b>{view.next.item.time} {view.next.item.title}</b>
                  <p>{view.next.item.detail}</p>
                </article>
              )}
            </div>
          )}

          {view.deadlines.length > 0 && (
            <ol className="companion-deadlines">
              {view.deadlines.map((entry) => (
                <li key={`${entry.item.time}-${entry.item.title}`}>
                  <b>{entry.item.time}</b>
                  <span>{entry.item.title}</span>
                  <em>{inMinutesTh(entry.inMinutes)}</em>
                </li>
              ))}
            </ol>
          )}

          {view.status === "matchday" && view.stadium && (
            <div className="companion-stadium">
              <b>{view.stadium.stadium}</b>
              <dl>
                <div><dt>สถานีใกล้สุด</dt><dd>{view.stadium.nearestStation}</dd></div>
                <div><dt>เดินทางในเมือง</dt><dd>{view.stadium.localTransit}</dd></div>
              </dl>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ส่งคำขอทั้งทริปในครั้งเดียว (STEP 76) ──────────────────────────────
// เดิมต้องกด GOG ทีละรายการ กรอกชื่อ เบอร์ วันที่ ซ้ำห้ารอบ แล้วยังไม่รู้ว่า
// ใครตอบแล้วบ้าง ปุ่มนี้รวบทุกอย่างเป็นคำขอชุดเดียวที่มีรหัสให้ตามสถานะได้

type TripRequestLine = {
  key: string;
  kind: PartnerKind;
  partner: Partner;
  serviceDate: string;
  /** รายการในแผนเที่ยวที่เป็นที่มาของคำขอนี้ */
  context: string;
};

type TripRequestResponse = {
  groupId: string;
  sent: Array<{ partnerName: string; kind: PartnerKind; serviceDate: string }>;
  rejected: Array<{ partnerId: string; reason: string }>;
};

const REJECT_REASON_TH: Record<string, string> = {
  not_found: "ไม่พบผู้ให้บริการรายนี้แล้ว",
  not_verified: "ผู้ให้บริการรายนี้ถูกระงับหรือยังไม่ผ่านการตรวจสอบ",
  bad_date: "วันที่ไม่ถูกต้อง",
};

/**
 * เลือกผู้ให้บริการอันดับหนึ่งของแต่ละประเภทให้อัตโนมัติ แล้วผู้ใช้ปรับได้
 * ที่พักใช้วันแรกของทริปเป็นวันเข้าพัก ส่วนรถกับร้านอาหารผูกกับวันที่ในแผนจริง
 */
function buildTripRequestLines(
  itinerary: ItineraryDay[],
  partnersByKind: Partial<Record<PartnerKind, Partner[]>>,
): TripRequestLine[] {
  const lines: TripRequestLine[] = [];
  const usedKindDate = new Set<string>();

  for (const day of itinerary) {
    for (const item of day.items) {
      const kind = ITEM_PARTNER_KIND[item.icon];
      if (!kind) continue;
      const partner = partnersByKind[kind]?.[0];
      if (!partner) continue;
      // ประเภทเดียวกันในวันเดียวกันขอครั้งเดียวพอ ไม่งั้นวันที่กินสามมื้อจะยิงร้านอาหารสามรอบ
      const dedupeKey = `${kind}-${day.date}`;
      if (usedKindDate.has(dedupeKey)) continue;
      usedKindDate.add(dedupeKey);
      lines.push({
        key: dedupeKey,
        kind,
        partner,
        serviceDate: day.date,
        context: `DAY ${day.dayNumber} · ${item.title}`,
      });
    }
  }
  return lines;
}

function TripRequestPanel({ itinerary, partnersByKind, travellers, matchLabel, tripTitle, departDate, returnDate }: {
  itinerary: ItineraryDay[];
  partnersByKind: Partial<Record<PartnerKind, Partner[]>>;
  travellers: number;
  matchLabel: string;
  tripTitle: string;
  departDate: string;
  returnDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TripRequestResponse | null>(null);
  const [error, setError] = useState("");

  const lines = useMemo(
    () => buildTripRequestLines(itinerary, partnersByKind),
    [itinerary, partnersByKind],
  );
  const selected = lines.filter((line) => !skipped.includes(line.key));
  const ready = name.trim().length > 0 && contact.trim().length > 0 && selected.length > 0;

  if (lines.length === 0) return null;

  const send = async () => {
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/bookings/trip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          travellerName: name.trim(),
          travellerContact: contact.trim(),
          tripTitle, matchLabel, departDate, returnDate,
          pax: travellers,
          note: note.trim(),
          items: selected.map((line) => ({
            partnerId: line.partner.id,
            serviceId: line.partner.services[0]?.id ?? "",
            serviceDate: line.serviceDate,
            message: line.context,
          })),
        }),
      });
      const payload = await response.json() as TripRequestResponse & { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "ส่งไม่สำเร็จ");
      setResult(payload);
    } catch {
      setError("ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="trip-request">
      <header>
        <div>
          <span className="eyebrow">GOG NETWORK</span>
          <strong><Handshake size={15} aria-hidden="true" /> ส่งคำขอทั้งทริปในครั้งเดียว</strong>
          <small>
            รวมรถรับส่ง ที่พัก และร้านอาหารจากแผนเที่ยวนี้เป็นคำขอชุดเดียว
            กรอกชื่อกับเบอร์ครั้งเดียว ได้รหัสไว้ตามสถานะว่าใครตอบรับแล้วบ้าง
          </small>
        </div>
        <button type="button" className="trip-request-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? "ซ่อน" : `ดู ${lines.length} รายการ`}
        </button>
      </header>

      {open && !result && (
        <>
          <ul className="trip-request-lines">
            {lines.map((line) => {
              const on = !skipped.includes(line.key);
              return (
                <li key={line.key} className={on ? "" : "off"}>
                  <label>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSkipped((current) => (on
                        ? [...current, line.key]
                        : current.filter((key) => key !== line.key)))}
                    />
                    <b>{PARTNER_KIND_LABEL[line.kind]} · {line.partner.displayName}</b>
                    <span>{thaiDate(line.serviceDate)} · {line.context}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="trip-request-form">
            <label>
              <span>ชื่อผู้เดินทาง</span>
              <input type="text" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>ช่องทางติดต่อกลับ</span>
              <input type="text" value={contact} maxLength={200} placeholder="LINE ID หรือเบอร์โทร"
                onChange={(event) => setContact(event.target.value)} />
            </label>
            <label className="wide">
              <span>บอกอะไรเพิ่มไหม</span>
              <textarea value={note} maxLength={800} rows={2} placeholder="เช่น มีเด็กเล็กไปด้วย ขอรถที่มีคาร์ซีท"
                onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>

          <p className="trip-request-privacy">
            ชื่อและช่องทางติดต่อของคุณจะถูกส่งให้ผู้ให้บริการ {selected.length} รายที่เลือกไว้เท่านั้น
            และส่งเฉพาะรายที่ผ่านการตรวจสอบของทีมงานแล้ว
          </p>

          <button type="button" className="trip-request-send" onClick={send} disabled={!ready || sending}>
            {sending ? "กำลังส่ง…" : `ส่งคำขอ ${selected.length} รายการ`}
          </button>
          {error && <p className="trip-request-error">{error}</p>}
        </>
      )}

      {result && (
        <div className="trip-request-done">
          <b>ส่งคำขอแล้ว {result.sent.length} รายการ</b>
          <p>รหัสคำขอชุดนี้ <code>{result.groupId}</code> — เก็บไว้ตามสถานะได้</p>
          <ul>
            {result.sent.map((entry) => (
              <li key={`${entry.partnerName}-${entry.serviceDate}`}>
                {PARTNER_KIND_LABEL[entry.kind]} · {entry.partnerName} · {thaiDate(entry.serviceDate)}
              </li>
            ))}
          </ul>
          {result.rejected.length > 0 && (
            <div className="trip-request-rejected">
              <b>ส่งไม่ได้ {result.rejected.length} รายการ</b>
              <ul>
                {result.rejected.map((entry) => (
                  <li key={entry.partnerId}>{REJECT_REASON_TH[entry.reason] ?? entry.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <small>ผู้ให้บริการจะติดต่อกลับตามช่องทางที่ให้ไว้ · ยังไม่มีการชำระเงินในขั้นนี้</small>
        </div>
      )}
    </div>
  );
}

function ItineraryDayCard({ day, money, onRemove, partnersByKind, travellers, tripId }: {
  day: ItineraryDay;
  money: (amount: number) => string;
  onRemove: (placeId: string) => void;
  partnersByKind: Partial<Record<PartnerKind, Partner[]>>;
  travellers: number;
  tripId: string;
}) {
  // เปิดได้ทีละรายการในวันเดียวกัน — เก็บ index ของรายการที่กางอยู่
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <article className={`itinerary-day day-${day.theme}`}>
      <header>
        <span className="itinerary-day-no">DAY {day.dayNumber}</span>
        <div>
          <h4>{day.title}</h4>
          <span className="itinerary-day-date">{thaiDate(day.date)}</span>
        </div>
        <b>{money(day.costThb)}</b>
      </header>
      <p className="itinerary-day-summary">{day.summary}</p>
      <ol className="itinerary-timeline">
        {day.items.map((item, index) => {
          // รถ / ร้านอาหาร / ที่พัก — ถ้ามีคนในเครือข่ายรับงานนี้ได้ ขึ้นปุ่มให้กดเลย
          const partnerKind = ITEM_PARTNER_KIND[item.icon];
          const matches = partnerKind ? partnersByKind[partnerKind] ?? [] : [];
          const open = openIndex === index;
          return (
            <li key={`${item.time}-${index}`} className={item.highlight ? "highlight" : ""}>
              <time>{item.time}</time>
              <span className="item-icon" aria-hidden="true">
                {(() => { const Icon = ITEM_ICON[item.icon] ?? Clock; return <Icon size={14} />; })()}
              </span>
              <div>
                <strong>{item.title}{item.booking ? <em className="need-booking">ต้องจองล่วงหน้า</em> : null}</strong>
                <p>{item.detail}</p>
                <small>
                  {item.area ? `${item.area} · ` : ""}
                  ใช้เวลา {item.durationMinutes} นาที
                  {item.costThb > 0 ? ` · ${money(item.costThb)}` : " · ไม่มีค่าใช้จ่าย"}
                </small>
                {(matches.length > 0 || item.placeId) && (
                  <div className="item-actions">
                    {matches.length > 0 && partnerKind && (
                      <button
                        type="button"
                        className={`item-gog ${open ? "open" : ""}`}
                        aria-expanded={open}
                        onClick={() => setOpenIndex(open ? null : index)}
                      >
                        <Handshake size={12} aria-hidden="true" />
                        {PARTNER_KIND_LABEL[partnerKind]} GOG
                        <em>{matches.length} ราย</em>
                      </button>
                    )}
                    {item.placeId && (
                      <button type="button" className="item-remove" onClick={() => onRemove(item.placeId!)}>
                        ตัดออกจากแผน
                      </button>
                    )}
                  </div>
                )}
                {open && partnerKind && (
                  <GogPartnerPicker
                    partners={matches}
                    kind={partnerKind}
                    serviceDate={day.date}
                    travellers={travellers}
                    tripId={tripId}
                    onClose={() => setOpenIndex(null)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/**
 * initialFixtureKey มาจากปุ่ม "วางแผนไปดูเกมนี้" ใน Match Center
 * ส่งเป็นคีย์เดียวกับ fixtureKey() ของ services/football/fixtures จึงเลือกแมตช์ได้ตรง
 */
export function TripPlanner({ initialFixtureKey }: { initialFixtureKey?: string } = {}) {
  // เริ่มจากไฟล์ในโปรเจกต์ก่อนเพื่อให้หน้าใช้งานได้ทันทีโดยไม่ต้องรอเน็ต
  // แล้วค่อยสลับเป็นข้อมูลจริงจาก API เมื่อโหลดเสร็จ — คีย์แมตช์เป็นรูปแบบเดียวกัน
  // แมตช์ที่ผู้ใช้เลือกไว้จึงไม่หลุดตอนสลับ
  const localFixtures = useMemo(() => listPlannableFixtures(), []);
  const [liveFixtures, setLiveFixtures] = useState<PlannableFixture[] | null>(null);
  const [fixtureSource, setFixtureSource] = useState<"local" | "live">("local");
  const fixtures = liveFixtures ?? localFixtures;

  useEffect(() => {
    let alive = true;
    fetch("/api/football/fixtures")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { fixtures?: Parameters<typeof gogToPlannable>[0][]; demo?: boolean } | null) => {
        // โหมดสาธิตไม่ต้องสลับ เพราะไฟล์ในโปรเจกต์เป็นโปรแกรมจริงที่ตรวจแล้ว
        if (!alive || !payload?.fixtures || payload.demo) return;
        const mapped = payload.fixtures
          .map(gogToPlannable)
          .filter((item): item is PlannableFixture => item !== null)
          // เครื่องมือนี้วางแผนทริปตามแมนเชสเตอร์ ยูไนเต็ดเท่านั้น
          .filter((item) => item.home === "Manchester United" || item.away === "Manchester United")
          .filter((item) => new Date(item.kickoffUtc).getTime() > Date.now());
        if (mapped.length === 0) return;
        setLiveFixtures(mapped);
        setFixtureSource("live");
      })
      .catch(() => { /* ดึงไม่ได้ก็ใช้ไฟล์ในโปรเจกต์ต่อไป */ });
    return () => { alive = false; };
  }, []);
  const [fixtureKey, setFixtureKey] = useState<string>(() => {
    if (initialFixtureKey && fixtures.some((item) => item.key === initialFixtureKey)) return initialFixtureKey;
    return fixtures[0]?.key ?? "";
  });
  const [length, setLength] = useState<TripLength>(5);
  const [budget, setBudget] = useState<BudgetStyle>("comfort");
  const [travellers, setTravellers] = useState(2);
  const [currency, setCurrency] = useState<"THB" | "GBP">("THB");
  // วันเดินทางมาจากคำแนะนำรอบวันแข่ง ผู้ใช้แก้ทับได้
  // เก็บ override พร้อม signature ของ (แมตช์+ความยาวทริป) — พอเปลี่ยนแมตช์
  // signature ไม่ตรง ค่าที่แก้ไว้จะถูกมองข้ามเอง ไม่ต้องใช้ effect คอยล้าง
  const [dateOverride, setDateOverride] = useState<{ sig: string; depart: string; back: string } | null>(null);
  const [flightId, setFlightId] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [flightSort, setFlightSort] = useState<FlightSort>("best");
  const [cityFilter, setCityFilter] = useState<DestinationCity | "All">("All");
  const [venueFilter, setVenueFilter] = useState<"all" | "home" | "away">("all");
  const [removedPlaceIds, setRemovedPlaceIds] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantReply, setAssistantReply] = useState<{ reply: string; changed: string[] } | null>(null);
  const [tripError, setTripError] = useState("");
  const [weather, setWeather] = useState<MatchWeather | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  // วีซ่า — ยังไม่เลือกอะไรเลยคือไม่บวกเข้าราคาทริป ต้องกด + เองทุกชิ้น (STEP 41)
  const [visa, setVisa] = useState<VisaSelection>(EMPTY_VISA);
  const [checkedDocs, setCheckedDocs] = useState<string[]>([]);
  const [savedTripId, setSavedTripId] = useState("");
  const [showAllFixtures, setShowAllFixtures] = useState(false);
  const [fixtureSort, setFixtureSort] = useState<"advice" | "date" | "price" | "leave">("advice");
  // STEP 6 พับไว้ก่อน — คนส่วนใหญ่มีวีซ่าอยู่แล้วหรือยังไม่ถึงขั้นนั้น กางเมื่อสนใจ
  const [visaOpen, setVisaOpen] = useState(false);
  // เรตปอนด์จริงจาก /api/fx — ระหว่างรอใช้ค่าสำรองไปก่อน ตัวเลขจึงไม่กระพริบเป็นศูนย์
  const [fx, setFx] = useState<{ rate: number; date: string; source: string; live: boolean }>(
    { rate: GBP_TO_THB, date: "", source: "ค่าสำรองในระบบ", live: false },
  );

  const fixture = useMemo(() => fixtures.find((item) => item.key === fixtureKey) ?? null, [fixtures, fixtureKey]);
  const city: DestinationCity = fixture?.destination ?? "Manchester";
  const matchDate = fixture ? fixture.kickoffUtc.slice(0, 10) : null;

  const dateSignature = `${fixtureKey}-${length}`;
  const recommended = fixture ? recommendTripDates(fixture.kickoffUtc, length) : null;
  const activeOverride = dateOverride?.sig === dateSignature ? dateOverride : null;
  const departDate = activeOverride?.depart ?? recommended?.departDate ?? "";
  const returnDate = activeOverride?.back ?? recommended?.returnDate ?? "";
  const setDepartDate = (value: string) =>
    setDateOverride({ sig: dateSignature, depart: value, back: returnDate });
  const setReturnDate = (value: string) =>
    setDateOverride({ sig: dateSignature, depart: departDate, back: value });

  const nights = departDate && returnDate ? Math.max(daysBetween(departDate, returnDate), 1) : hotelNights(length);
  const airportsForCity = useMemo(() => ARRIVAL_AIRPORTS.filter((airport) => airport.city === city), [city]);
  const flights = useMemo(
    () => listFlights(airportsForCity.map((airport) => airport.code), budget, flightSort),
    [airportsForCity, budget, flightSort],
  );
  const selectedFlight = flights.find((item) => item.id === flightId) ?? flights[0] ?? null;

  const hotels = useMemo(() => listHotels(city, budget), [city, budget]);
  const selectedHotel = hotels.find((item) => item.id === hotelId) ?? defaultHotel(city, budget);

  // ค่ารถไฟไปสนามต่างเมืองในวันแข่ง — เฉพาะนัดที่สนามไม่ได้อยู่ในเมืองฐาน
  const railPlan = fixture?.railDay ? getStadiumTravelPlan(fixture.stadium) : null;
  const railLine = useMemo(() => (railPlan ? [{
    key: "railday",
    label: `รถไฟไป-กลับ ${railPlan.destination} วันแข่ง`,
    amount: railDayTripThb(railPlan.distanceKm, budget),
    note: `${railPlan.origin} → ${railPlan.destination} · ${railPlan.railMinutes} นาที + ต่อรถอีก ${railPlan.lastMileMinutes} นาที · จองล่วงหน้าถูกกว่ามาก`,
  }] : []), [railPlan, budget]);

  // ค่าวีซ่าต่อคนตามที่กด + ไว้ — ป้อนเข้า estimateTrip เป็นบรรทัดเพิ่มเติม พร้อมเรตปอนด์จริง
  const visaLines = useMemo(() => visaCostLines(visa, travellers, fx.rate), [visa, travellers, fx.rate]);
  const extraLines = useMemo(() => [...railLine, ...visaLines], [railLine, visaLines]);

  const estimate = useMemo(() => estimateTrip({
    length,
    nights,
    city,
    budget,
    travellers,
    flightFare: selectedFlight?.estimatedFare[budget] ?? 0,
    hotelNightly: selectedHotel?.nightlyThb ?? 0,
    includeMatch: Boolean(fixture),
    extraLines,
  }), [length, nights, city, budget, travellers, selectedFlight, selectedHotel, fixture, extraLines]);

  // เทียบ 3 ระดับงบด้วยตัวเลือกที่ดีที่สุดของแต่ละระดับ (STEP 7)
  const budgetComparison = useMemo(() => BUDGET_ORDER.map((style) => {
    const flight = listFlights(airportsForCity.map((airport) => airport.code), style, "best")[0];
    const hotel = defaultHotel(city, style);
    return {
      style,
      estimate: estimateTrip({
        length,
        nights,
        city,
        budget: style,
        travellers,
        flightFare: flight?.estimatedFare[style] ?? 0,
        hotelNightly: hotel?.nightlyThb ?? 0,
        includeMatch: Boolean(fixture),
        extraLines,
      }),
    };
  }), [airportsForCity, city, length, nights, travellers, fixture, extraLines]);

  const arrivalDate = departDate ? addDays(departDate, selectedFlight?.arrivesMorning ? 1 : 1) : "";
  const warning = arrivalDate ? arrivalWarning(arrivalDate, matchDate) : null;

  // หาแมตช์ที่ทริปถูกที่สุด — คิดจากราคาจริงของแต่ละเมืองในระดับงบปัจจุบัน
  const cheapestKey = useMemo(() => {
    let best: { key: string; price: number } | null = null;
    for (const item of fixtures) {
      if (!item.destination) continue;
      const airports = ARRIVAL_AIRPORTS.filter((airport) => airport.city === item.destination);
      const flight = listFlights(airports.map((airport) => airport.code), budget, "cheapest")[0];
      const hotel = defaultHotel(item.destination, budget);
      const price = estimateTrip({
        length, nights: length - 1, city: item.destination, budget, travellers,
        flightFare: flight?.estimatedFare[budget] ?? 0,
        hotelNightly: hotel?.nightlyThb ?? 0,
        includeMatch: true,
      }).perPerson;
      if (!best || price < best.price) best = { key: item.key, price };
    }
    return best?.key;
  }, [fixtures, budget, length, travellers]);

  // ราคาต่อคนของทุกนัดในระดับงบปัจจุบัน — ใช้ทั้งเรียงตามราคาและโชว์บนการ์ด
  const priceByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of fixtures) {
      const airports = ARRIVAL_AIRPORTS.filter((airport) => airport.city === item.destination);
      const flight = listFlights(airports.map((airport) => airport.code), budget, "best")[0];
      const hotel = defaultHotel(item.destination, budget);
      const plan = item.railDay ? getStadiumTravelPlan(item.stadium) : null;
      map.set(item.key, estimateTrip({
        length, nights: length - 1, city: item.destination, budget, travellers,
        flightFare: flight?.estimatedFare[budget] ?? 0,
        hotelNightly: hotel?.nightlyThb ?? 0,
        includeMatch: true,
        extraLines: plan ? [{ key: "railday", label: "รถไฟวันแข่ง", amount: railDayTripThb(plan.distanceKm, budget) }] : [],
      }).perPerson);
    }
    return map;
  }, [fixtures, budget, length, travellers]);

  // จำนวนวันลาของแต่ละนัด — คิดจากช่วงวันที่ระบบแนะนำสำหรับความยาวทริปที่เลือกอยู่
  const leaveByKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof leaveDaysFor>>();
    for (const item of fixtures) {
      const dates = recommendTripDates(item.kickoffUtc, length);
      map.set(item.key, leaveDaysFor(dates.departDate, dates.returnDate));
    }
    return map;
  }, [fixtures, length]);

  const filteredFixtures = fixtures.filter((item) => {
    if (cityFilter !== "All" && item.destination !== cityFilter) return false;
    if (venueFilter === "home" && !item.isHome) return false;
    if (venueFilter === "away" && item.isHome) return false;
    return true;
  });

  const visibleFixtures = useMemo(() => {
    if (fixtureSort === "date") {
      return [...filteredFixtures].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
    }
    if (fixtureSort === "price") {
      return [...filteredFixtures].sort((a, b) => (priceByKey.get(a.key) ?? 0) - (priceByKey.get(b.key) ?? 0));
    }
    if (fixtureSort === "leave") {
      // ลาน้อยที่สุดก่อน — เท่ากันให้เอานัดที่ใกล้ที่สุดขึ้นก่อน
      return [...filteredFixtures].sort((a, b) => {
        const diff = (leaveByKey.get(a.key)?.leaveDays ?? 99) - (leaveByKey.get(b.key)?.leaveDays ?? 99);
        return diff !== 0 ? diff : a.kickoffUtc.localeCompare(b.kickoffUtc);
      });
    }
    return sortByRecommendation(filteredFixtures, cheapestKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtures, cityFilter, venueFilter, fixtureSort, priceByKey, leaveByKey, cheapestKey]);

  // วันลาของทริปที่กำลังวางอยู่จริง (ตามวันที่ผู้ใช้แก้เอง ไม่ใช่วันแนะนำ)
  const leave = useMemo(() => leaveDaysFor(departDate, returnDate), [departDate, returnDate]);

  // ── STEP 11/12/21 · แผนเที่ยวรายวัน ─────────────────────────────────
  const itineraryInput = {
    city,
    departDate,
    length,
    matchDate,
    kickoffUtc: fixture?.kickoffUtc ?? null,
    stadium: fixture?.stadium ?? null,
    // สนามต่างเมืองต้องเผื่อเวลารถไฟทั้งเที่ยว + เวลาไปถึงสถานีต้นทางอีก 25 นาที
    minutesToStadium: railPlan
      ? totalTravelMinutes(railPlan) + 25
      : selectedHotel?.minutesToStadium ?? 30,
    arrivesMorning: selectedFlight?.arrivesMorning ?? false,
    awayDay: Boolean(fixture?.railDay),
    venueCity: fixture?.venueCity,
  };
  const itinerary = useMemo(
    () => (departDate ? buildItinerary(itineraryInput) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city, departDate, length, matchDate, fixture?.kickoffUtc, fixture?.stadium, fixture?.railDay, itineraryInput.minutesToStadium, selectedFlight?.arrivesMorning],
  );
  const visibleItinerary = useMemo(
    () => itinerary.map((day) => {
      const items = day.items.filter((item) => !removedPlaceIds.includes(item.placeId ?? ""));
      return { ...day, items, costThb: items.reduce((sum, item) => sum + item.costThb, 0) };
    }),
    [itinerary, removedPlaceIds],
  );
  const conflicts = useMemo(
    () => (itinerary.length ? detectConflicts(itinerary, itineraryInput) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itinerary],
  );
  const pilgrimage = useMemo(() => pilgrimageIn(city), [city]);

  // สรุปสถานะทริปปัจจุบัน — ใช้ทั้งตอนบันทึกและตอนส่งให้ผู้ช่วย
  const tripState = useMemo(() => ({
    fixtureKey, length, budget, travellers, currency,
    departDate, returnDate, flightId: selectedFlight?.id ?? "", hotelId: selectedHotel?.id ?? "",
    removedPlaceIds, visa, checkedDocs,
  }), [fixtureKey, length, budget, travellers, currency, departDate, returnDate, selectedFlight?.id, selectedHotel?.id, removedPlaceIds, visa, checkedDocs]);

  // โหลดทริปที่แชร์มาจาก ?trip=<id> ครั้งเดียวตอนเปิดหน้า
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("trip");
    if (!id) return;
    let alive = true;
    fetch(`/api/trips/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { payload?: typeof tripState } | null) => {
        const saved = payload?.payload;
        if (!alive || !saved) return;
        if (saved.fixtureKey) setFixtureKey(saved.fixtureKey);
        if (saved.length) setLength(saved.length);
        if (saved.budget) setBudget(saved.budget);
        if (saved.travellers) setTravellers(saved.travellers);
        if (saved.currency) setCurrency(saved.currency);
        if (saved.flightId) setFlightId(saved.flightId);
        if (saved.hotelId) setHotelId(saved.hotelId);
        if (saved.removedPlaceIds) setRemovedPlaceIds(saved.removedPlaceIds);
        if (saved.visa) setVisa({ ...EMPTY_VISA, ...saved.visa });
        if (saved.checkedDocs) setCheckedDocs(saved.checkedDocs);
        if (saved.departDate && saved.returnDate) {
          setDateOverride({ sig: `${saved.fixtureKey}-${saved.length}`, depart: saved.departDate, back: saved.returnDate });
        }
        setSavedTripId(id);
      })
      .catch(() => { /* ลิงก์เสีย = เริ่มวางแผนใหม่ตามปกติ */ });
    return () => { alive = false; };
  }, []);

  // เรตปอนด์จริง ดึงครั้งเดียวตอนเปิดหน้า — ล้มเหลวก็ใช้ค่าสำรองที่ตั้งไว้แล้ว
  useEffect(() => {
    let alive = true;
    fetch("/api/fx")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ok?: boolean; rate?: number; date?: string; source?: string; live?: boolean } | null) => {
        if (!alive || !payload?.rate) return;
        setFx({ rate: payload.rate, date: payload.date ?? "", source: payload.source ?? "", live: Boolean(payload.live) });
      })
      .catch(() => { /* ใช้ค่าสำรองต่อไป */ });
    return () => { alive = false; };
  }, []);

  // อากาศวันแข่งจาก Open-Meteo — พยากรณ์ล่วงหน้าได้ประมาณ 16 วัน ไกลกว่านั้นคืนว่าง
  useEffect(() => {
    let alive = true;
    if (!matchDate) {
      window.queueMicrotask(() => { if (alive) setWeather(null); });
      return () => { alive = false; };
    }
    fetch(`/api/weather?city=${encodeURIComponent(city)}&date=${matchDate}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { weather?: MatchWeather } | null) => { if (alive) setWeather(payload?.weather ?? null); })
      .catch(() => { if (alive) setWeather(null); });
    return () => { alive = false; };
  }, [city, matchDate]);

  // พาร์ตเนอร์คนไทยในเมืองปลายทาง (เฉพาะที่ตรวจเอกสารแล้ว)
  useEffect(() => {
    let alive = true;
    fetch(`/api/partners?city=${encodeURIComponent(city)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { partners?: Partner[] } | null) => { if (alive) setPartners(payload?.partners ?? []); })
      .catch(() => { if (alive) setPartners([]); });
    return () => { alive = false; };
  }, [city]);

  const saveTrip = useCallback(async () => {
    setSaving(true);
    setTripError("");
    try {
      const title = fixture ? `${fixture.home} v ${fixture.away} · ${length} วัน` : `ทริป ${length} วัน`;
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, payload: tripState }),
      });
      const payload = await response.json() as { ok?: boolean; id?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.id) throw new Error(payload.error || "บันทึกไม่สำเร็จ");
      const link = `${window.location.origin}${window.location.pathname}?trip=${payload.id}`;
      setShareUrl(link);
      setSavedTripId(payload.id);
      try { await navigator.clipboard.writeText(link); } catch { /* คลิปบอร์ดถูกบล็อก */ }
    } catch (error) {
      setTripError(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [fixture, length, tripState]);

  const kickoffUtc = fixture?.kickoffUtc ?? null;
  const askGog = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setAssistantBusy(true);
    setTripError("");
    setAssistantReply(null);
    try {
      const catalogue = {
        flights: FLIGHT_OPTIONS.filter((item) => airportsForCity.some((airport) => airport.code === item.arrivalCode))
          .map((item) => ({ id: item.id, airline: item.airline, to: item.arrivalCode, stops: item.stops, arrivesMorning: item.arrivesMorning })),
        hotels: HOTEL_OPTIONS.filter((item) => item.city === city)
          .map((item) => ({ id: item.id, name: item.name, area: item.area, stars: item.stars, nightlyThb: item.nightlyThb, bestFor: item.bestFor })),
        places: PLACES.filter((item) => item.city === city)
          .map((item) => ({ id: item.id, name: item.name, kind: item.kind, area: item.area, costThb: item.costThb })),
      };
      const response = await fetch("/api/trip-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          trip: { ...tripState, city, matchDate: kickoffUtc ? kickoffUtc.slice(0, 10) : null },
          catalogue,
        }),
      });
      const payload = await response.json() as {
        ok?: boolean; error?: string; reply?: string; changed?: string[];
        patch?: { budget?: BudgetStyle; length?: TripLength; travellers?: number; flightId?: string; hotelId?: string; removePlaceIds?: string[]; addPlaceIds?: string[] };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error === "assistant_not_configured"
          ? "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บน Worker"
          : payload.error || "ผู้ช่วยตอบไม่ได้");
      }
      const patch = payload.patch ?? {};
      if (patch.budget) setBudget(patch.budget);
      if (patch.length) setLength(patch.length);
      if (patch.travellers) setTravellers(Math.min(Math.max(patch.travellers, 1), 12));
      if (patch.flightId) setFlightId(patch.flightId);
      if (patch.hotelId) setHotelId(patch.hotelId);
      if (patch.removePlaceIds?.length || patch.addPlaceIds?.length) {
        setRemovedPlaceIds((current) => {
          const next = new Set([...current, ...(patch.removePlaceIds ?? [])]);
          for (const id of patch.addPlaceIds ?? []) next.delete(id);
          return [...next];
        });
      }
      setAssistantReply({ reply: payload.reply ?? "", changed: payload.changed ?? [] });
      setAssistantQuestion("");
    } catch (error) {
      setTripError(error instanceof Error ? error.message : "ผู้ช่วยตอบไม่ได้");
    } finally {
      setAssistantBusy(false);
    }
  }, [airportsForCity, city, kickoffUtc, tripState]);

  // ── STEP 24 · จำลอง "ถ้าเปลี่ยนแบบนี้" — คิดจาก service ตัวเดียวกับราคาจริง
  const whatIf = (over: { length?: TripLength; budget?: BudgetStyle; nights?: number }) => {
    const nextLength = over.length ?? length;
    const nextBudget = over.budget ?? budget;
    const nextNights = over.nights ?? (over.length ? over.length - 1 : nights);
    const flight = listFlights(airportsForCity.map((airport) => airport.code), nextBudget, "best")[0];
    const hotel = defaultHotel(city, nextBudget);
    return estimateTrip({
      length: nextLength,
      nights: nextNights,
      city,
      budget: nextBudget,
      travellers,
      flightFare: flight?.estimatedFare[nextBudget] ?? 0,
      hotelNightly: hotel?.nightlyThb ?? 0,
      includeMatch: Boolean(fixture),
      extraLines,
    }).perPerson;
  };

  const whatIfs = [
    {
      label: length === 5 ? "ไป 8 วันแทน 5 วัน" : length === 8 ? "ไป 10 วันแทน 8 วัน" : "ไป 5 วันแทน 10 วัน",
      delta: whatIf({ length: length === 5 ? 8 : length === 8 ? 10 : 5 }) - estimate.perPerson,
      apply: () => setLength(length === 5 ? 8 : length === 8 ? 10 : 5),
    },
    {
      label: "อัปเกรดเป็น Comfort",
      delta: whatIf({ budget: "comfort" }) - estimate.perPerson,
      apply: () => setBudget("comfort"),
    },
    {
      label: "อัปเกรดเป็น Premium",
      delta: whatIf({ budget: "premium" }) - estimate.perPerson,
      apply: () => setBudget("premium"),
    },
    {
      label: "ลดเหลือ Smart Saver",
      delta: whatIf({ budget: "saver" }) - estimate.perPerson,
      apply: () => setBudget("saver"),
    },
    {
      label: "อยู่เพิ่มอีก 1 คืน",
      delta: whatIf({ nights: nights + 1 }) - estimate.perPerson,
      apply: () => setReturnDate(addDays(returnDate, 1)),
    },
  ];

  const hasMatch = Boolean(fixture);
  const rankedPartners = useMemo(
    () => rankPartners(partners, { city, travellers, matchday: hasMatch }).slice(0, 6),
    [partners, city, travellers, hasMatch],
  );

  // จัดกลุ่มพาร์ตเนอร์ตามประเภทไว้ล่วงหน้า ให้ทุกรายการในแผนเที่ยวหยิบไปใช้ได้ทันที
  // เรียงตามคะแนนความเหมาะกับทริปแล้ว เก็บประเภทละไม่เกิน 5 รายไม่ให้เมนูยาวเกินอ่าน
  const partnersByKind = useMemo(() => {
    const grouped: Partial<Record<PartnerKind, Partner[]>> = {};
    for (const { partner } of rankPartners(partners, { city, travellers, matchday: hasMatch })) {
      const list = grouped[partner.kind] ?? [];
      if (list.length >= 5) continue;
      list.push(partner);
      grouped[partner.kind] = list;
    }
    return grouped;
  }, [partners, city, travellers, hasMatch]);

  // ── STEP 41 · วีซ่าอังกฤษ ───────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const visaTotalPerPerson = visaLines.reduce((sum, line) => sum + line.amount, 0);
  // แยกค่าราชการกับค่าดำเนินการ ให้เห็นว่าเงินก้อนไหนเลี่ยงไม่ได้ ก้อนไหนเลือกจ่ายเอง
  const breakdown = useMemo(() => visaBreakdown(visa, travellers, fx.rate), [visa, travellers, fx.rate]);
  const docCount = VISA_DOCUMENTS.reduce((sum, group) => sum + group.items.length, 0);

  const pickVisaType = (id: VisaSelection["typeId"]) =>
    setVisa((current) => ({ ...current, typeId: current.typeId === id ? null : id }));
  const toggleLodge = (id: string) =>
    setVisa((current) => ({
      ...current,
      lodgeIds: current.lodgeIds.includes(id)
        ? current.lodgeIds.filter((item) => item !== id)
        // Priority กับ Super Priority ซื้อพร้อมกันไม่ได้ เลือกอันใหม่ให้เขี่ยอันเก่าออก
        : [...current.lodgeIds.filter((item) => !(["priority", "super"].includes(item) && ["priority", "super"].includes(id))), id],
    }));
  const pickPackage = (id: string) =>
    setVisa((current) => ({ ...current, packageId: current.packageId === id ? null : id }));
  const toggleDoc = (key: string) =>
    setCheckedDocs((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  // แผนลงวันจริง — ต้องทำอะไรวันไหนตั้งแต่ทำพาสปอร์ตจนถึงวันบิน
  const visaPlan = useMemo(() => buildVisaPlan({
    departDate,
    returnDate,
    lodgeIds: visa.lodgeIds,
    needPassport: needsPassportWork(visa.passportStatus),
    needIdp: Boolean(visa.idpId),
    today,
  }), [departDate, returnDate, visa.lodgeIds, visa.passportStatus, visa.idpId, today]);

  const money = (amount: number) => formatMoney(amount, currency, fx.rate);
  const maxLine = Math.max(...estimate.lines.map((line) => line.amount), 1);

  return (
    <section className="trip-view" id="trip" aria-labelledby="trip-heading">
      {/* ── STEP 3 · ฮีโร่ + ฟอร์มวางแผน ─────────────────────────────────── */}
      <div className="trip-hero">
        <div className="trip-hero-copy">
          <span className="eyebrow">GOG TRAVEL · PREMIER LEAGUE</span>
          <h2 id="trip-heading">วางแผนทริปดูพรีเมียร์ลีก</h2>
          <p>จากกรุงเทพฯ ถึงวันแข่ง — ตั๋วเครื่องบิน ที่พัก ประสบการณ์สายบอล และแผนเที่ยวทั้งทริปในที่เดียว</p>
        </div>

        <div className="trip-form">
          <label className="trip-field trip-field-wide">
            <span><CalendarDays size={12} aria-hidden="true" /> แมตช์ที่อยากดู</span>
            <select value={fixtureKey} onChange={(event) => setFixtureKey(event.target.value)}>
              {fixtures.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.home} v {item.away} · {thaiDate(item.kickoffUtc.slice(0, 10))} · {item.city}
                </option>
              ))}
            </select>
          </label>

          <label className="trip-field">
            <span><Plane size={12} aria-hidden="true" /> ออกจาก</span>
            <input value={`${BANGKOK.city} — ${BANGKOK.code}`} readOnly />
          </label>

          <label className="trip-field">
            <span><MapPin size={12} aria-hidden="true" /> ปลายทาง</span>
            <input value={`${city} · ${airportsForCity.map((airport) => airport.code).join(" / ")}`} readOnly />
          </label>

          <label className="trip-field">
            <span>ออกเดินทาง</span>
            <input type="date" value={departDate} onChange={(event) => setDepartDate(event.target.value)} />
          </label>

          <label className="trip-field">
            <span>กลับถึงกรุงเทพฯ</span>
            <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
          </label>

          <div className="trip-field">
            <span>ความยาวทริป</span>
            <div className="trip-segment">
              {([5, 8, 10] as TripLength[]).map((value) => (
                <button key={value} type="button" className={length === value ? "active" : ""} onClick={() => setLength(value)}>
                  {value} วัน
                </button>
              ))}
            </div>
          </div>

          <label className="trip-field">
            <span><Users size={12} aria-hidden="true" /> จำนวนคน</span>
            <input
              type="number"
              min={1}
              max={12}
              value={travellers}
              onChange={(event) => setTravellers(Math.min(Math.max(Number(event.target.value) || 1, 1), 12))}
            />
          </label>

          <div className="trip-field trip-field-wide">
            <span><Coins size={12} aria-hidden="true" /> สไตล์การใช้เงิน</span>
            <div className="trip-segment">
              {BUDGET_ORDER.map((style) => (
                <button key={style} type="button" className={budget === style ? "active" : ""} onClick={() => setBudget(style)}>
                  {BUDGET_LABELS[style].name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── STEP 45 · ปฏิทินช่วงเดินทาง + วันลา ───────────────────────────── */}
      {departDate && returnDate && (
        <section className="trip-block calendar-block">
          <header className="trip-block-head">
            <div>
              <span className="eyebrow">CALENDAR</span>
              <h3><CalendarDays size={15} aria-hidden="true" /> ช่วงเดินทาง {length} วัน</h3>
            </div>
            {leave && (
              <div className="leave-summary">
                <span><b>{leave.leaveDays}</b> วันลา</span>
                <span><b>{leave.weekendDays}</b> เสาร์-อาทิตย์</span>
                <span><b>{leave.holidays.length}</b> วันหยุดราชการ</span>
              </div>
            )}
          </header>
          <TripCalendar
            departDate={departDate}
            returnDate={returnDate}
            matchDate={matchDate}
            lodgeBy={visaPlan?.lodgeBy ?? null}
          />
          {leave && leave.holidays.length > 0 && (
            <p className="trip-disclaimer">
              ทริปนี้กินวันหยุดราชการ {leave.holidays.map((entry) => `${entry.name}${entry.provisional ? " (ยังไม่ประกาศทางการ)" : ""}`).join(" · ")}
              {" "}— ยื่นใบลาแค่ {leave.leaveDays} วันก็ไปได้ทั้งทริป
            </p>
          )}
        </section>
      )}

      {warning && (
        <div className="trip-warning" role="status">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>{warning}</span>
        </div>
      )}

      <div className="trip-layout">
        <div className="trip-main">
          {/* ── STEP 4 · ปฏิทินโปรแกรมแข่ง ───────────────────────────────── */}
          <section className="trip-block">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">STEP 1</span>
                <h3>เลือกแมตช์</h3>
              </div>
              <div className="trip-filters">
                {(["All", "Manchester", "London"] as Array<DestinationCity | "All">).map((value) => (
                  <button key={value} type="button" className={cityFilter === value ? "active" : ""} onClick={() => setCityFilter(value)}>
                    {value === "All" ? "ทุกเมือง" : value === "Manchester" ? "แมนเชสเตอร์" : "ลอนดอน"}
                  </button>
                ))}
                {([["all", "ทั้งหมด"], ["home", "เหย้า"], ["away", "เยือน"]] as Array<[typeof venueFilter, string]>).map(([value, label]) => (
                  <button key={value} type="button" className={venueFilter === value ? "active" : ""} onClick={() => setVenueFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </header>

            <div className="fixture-sort">
              <span>เรียงตาม</span>
              {([["advice", "คำแนะนำ"], ["date", "วันที่"], ["price", "ราคาถูกสุด"], ["leave", "ลางานน้อยสุด"]] as Array<[typeof fixtureSort, string]>).map(([value, label]) => (
                <button key={value} type="button" className={fixtureSort === value ? "active" : ""} onClick={() => setFixtureSort(value)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="fixture-grid">
              {(showAllFixtures ? visibleFixtures : visibleFixtures.slice(0, 12)).map((item) => {
                const recommended = recommendTripDates(item.kickoffUtc, length);
                const active = item.key === fixtureKey;
                const advice = recommendFixture(item, cheapestKey);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`trip-fixture ${active ? "active" : ""} ${item.city === "Manchester" ? "manchester" : ""} ${advice.special ? "special" : ""}`}
                    onClick={() => setFixtureKey(item.key)}
                  >
                    <span className="trip-fixture-top">
                      <span className="trip-fixture-md">MW {item.matchday}</span>
                      <span className={`fixture-tier ${advice.tier}`}>
                        {advice.tier === "must" && <Star size={10} aria-hidden="true" />}
                        {advice.tierLabel}
                      </span>
                    </span>
                    <strong>{item.home}</strong>
                    <em>v</em>
                    <strong>{item.away}</strong>
                    <span className="trip-fixture-when">{ukKickoff(item)} <small>เวลาอังกฤษ</small></span>
                    <span className="trip-fixture-when">{thaiKickoff(item)} น. <small>เวลาไทย</small></span>
                    <span className="trip-fixture-venue">{item.stadium} · {item.city}</span>
                    {item.railDay && (() => {
                      const plan = getStadiumTravelPlan(item.stadium);
                      return (
                        <span className="trip-fixture-rail">
                          พักที่{item.destination === "Manchester" ? "แมนเชสเตอร์" : "ลอนดอน"} · รถไฟไปสนาม
                          {plan ? ` ${Math.round(totalTravelMinutes(plan) / 60 * 10) / 10} ชม.` : ""}
                        </span>
                      );
                    })()}
                    <span className="trip-fixture-rec">แนะนำเดินทาง {thaiDate(recommended.departDate)} – {thaiDate(recommended.returnDate)}</span>
                    {(() => {
                      const matchYmd = item.kickoffUtc.slice(0, 10);
                      const holiday = thaiHoliday(matchYmd);
                      const summary = leaveByKey.get(item.key);
                      return (
                        <span className="trip-fixture-leave">
                          <b className={summary && summary.leaveDays <= 2 ? "good" : ""}>
                            ลางาน {summary?.leaveDays ?? "—"} วัน
                          </b>
                          {summary && summary.weekendDays > 0 ? ` · เสาร์-อาทิตย์ ${summary.weekendDays} วัน` : ""}
                          {summary && summary.holidays.length > 0
                            ? ` · ตรงวันหยุด ${summary.holidays.map((entry) => entry.name).join(", ")}`
                            : ""}
                          {holiday ? <em className="fixture-holiday">วันแข่งตรง{holiday.name}</em> : null}
                        </span>
                      );
                    })()}
                    {fixtureSort === "price" && (
                      <span className="trip-fixture-price">ประมาณ {money(priceByKey.get(item.key) ?? 0)} ต่อคน</span>
                    )}
                    <span className="trip-fixture-badges">
                      {advice.badges.filter((badge) => badge.kind !== "must" && badge.kind !== "should").map((badge) => (
                        <span key={badge.label} className={`fixture-badge ${badge.kind}`}>{badge.label}</span>
                      ))}
                    </span>
                    <span className="trip-fixture-reason">{advice.reason}</span>
                    <span className={`trip-fixture-status ${item.status}`}>{item.status === "confirmed" ? "ยืนยันเวลาแล้ว" : "เวลาอาจเปลี่ยน"}</span>
                  </button>
                );
              })}
            </div>
            {visibleFixtures.length > 12 && (
              <button type="button" className="fixture-more" onClick={() => setShowAllFixtures((current) => !current)}>
                {showAllFixtures
                  ? `ย่อกลับเหลือ 12 นัด`
                  : `ดูครบทั้งฤดูกาล — อีก ${visibleFixtures.length - 12} นัด (ทั้งหมด ${visibleFixtures.length} นัดที่ยังไม่เตะ)`}
              </button>
            )}
            <p className="trip-disclaimer">
              {fixtureSource === "live"
                ? "โปรแกรมแข่งชุดนี้ดึงสดจากผู้ให้บริการข้อมูล ตรงกับที่แสดงใน Match Center · "
                : "โปรแกรมแข่งชุดนี้มาจากไฟล์ในระบบที่ทานกับโปรแกรมทางการแล้ว · "}
              วันและเวลาแข่งของพรีเมียร์ลีกเปลี่ยนได้จากการถ่ายทอดสดหรือรายการอื่น — ตรวจสอบอีกครั้งก่อนจองตั๋วที่คืนเงินไม่ได้
              · นัดที่สนามอยู่นอกแมนเชสเตอร์และลอนดอน ระบบวางให้พักเมืองฐานแล้วนั่งรถไฟไปกลับในวันแข่ง
              คิดค่ารถไฟและเวลาเดินทางให้ในแผนแล้ว
            </p>
          </section>

          {/* ── STEP 7 · เทียบ 3 ระดับงบ ─────────────────────────────────── */}
          <section className="trip-block">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">STEP 2</span>
                <h3>เลือกสไตล์การใช้เงิน</h3>
              </div>
              <div className="trip-filters">
                {(["THB", "GBP"] as const).map((value) => (
                  <button key={value} type="button" className={currency === value ? "active" : ""} onClick={() => setCurrency(value)}>
                    {value === "THB" ? "฿ บาท" : "£ ปอนด์"}
                  </button>
                ))}
              </div>
            </header>
            <div className="budget-grid">
              {budgetComparison.map(({ style, estimate: option }) => (
                <button
                  key={style}
                  type="button"
                  className={`budget-card ${budget === style ? "active" : ""}`}
                  onClick={() => setBudget(style)}
                >
                  <span className="budget-name">{BUDGET_LABELS[style].name}</span>
                  <span className="budget-tagline">{BUDGET_LABELS[style].tagline}</span>
                  <strong>{money(option.perPerson)}</strong>
                  <small>ต่อคน · {length} วัน {nights} คืน</small>
                </button>
              ))}
            </div>
          </section>

          {/* ── STEP 8 · ไฟลต์ ───────────────────────────────────────────── */}
          <section className="trip-block">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">STEP 3</span>
                <h3>เลือกไฟลต์ {BANGKOK.code} → {airportsForCity.map((airport) => airport.code).join(" / ")}</h3>
              </div>
              <div className="trip-filters">
                {([["best", "ดีที่สุด"], ["cheapest", "ถูกที่สุด"], ["fastest", "เร็วที่สุด"], ["arrival", "ถึงเช้า"]] as Array<[FlightSort, string]>).map(([value, label]) => (
                  <button key={value} type="button" className={flightSort === value ? "active" : ""} onClick={() => setFlightSort(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </header>
            <div className="option-list">
              {flights.map((flight) => (
                <button
                  key={flight.id}
                  type="button"
                  className={`option-card ${selectedFlight?.id === flight.id ? "active" : ""}`}
                  onClick={() => setFlightId(flight.id)}
                >
                  <div className="option-main">
                    <strong>{flight.airline}</strong>
                    <span>{flight.departLocal} → {flight.arriveLocal} · {Math.floor(flight.durationMinutes / 60)} ชม. {flight.durationMinutes % 60} น.</span>
                    <small>
                      {flight.stops === 0 ? "บินตรง" : `แวะ ${flight.via}`} · สัมภาระ {flight.baggageKg} กก. · ถึง {flight.arrivalCode}
                      {flight.arrivesMorning ? " · ถึงตอนเช้า มีเวลาทั้งวัน" : ""}
                    </small>
                  </div>
                  <div className="option-price">
                    <b>{money(flight.estimatedFare[budget])}</b>
                    <small>ประมาณการ ไป-กลับ</small>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── STEP 9 · โรงแรม ──────────────────────────────────────────── */}
          <section className="trip-block">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">STEP 4</span>
                <h3><Hotel size={15} aria-hidden="true" /> ที่พักใน{city === "Manchester" ? "แมนเชสเตอร์" : "ลอนดอน"}</h3>
              </div>
            </header>
            <div className="option-list">
              {hotels.map((hotel) => (
                <button
                  key={hotel.id}
                  type="button"
                  className={`option-card ${selectedHotel?.id === hotel.id ? "active" : ""}`}
                  onClick={() => setHotelId(hotel.id)}
                >
                  <div className="option-main">
                    <strong>{hotel.name}</strong>
                    <span className="hotel-stars">
                      {hotel.area}
                      <em aria-label={`${hotel.stars} ดาว`}>
                        {Array.from({ length: hotel.stars }, (_, index) => (
                          <Star key={index} size={11} aria-hidden="true" />
                        ))}
                      </em>
                    </span>
                    <small>
                      ใจกลางเมือง {hotel.minutesToCityCentre} น. · ถึงสนาม {hotel.minutesToStadium} น. · สถานี {hotel.nearestStation}
                    </small>
                    <em className="option-why"><b>เหมาะกับ:</b> {hotel.bestFor} — {hotel.why}</em>
                  </div>
                  <div className="option-price">
                    <b>{money(hotel.nightlyThb)}</b>
                    <small>ต่อคืน · ประมาณการ</small>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── STEP 11/12/21 · แผนเที่ยวรายวัน ──────────────────────────── */}
          <section className="trip-block" id="itinerary">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">STEP 5</span>
                <h3><Clock size={15} aria-hidden="true" /> แผนเที่ยว {length} วัน</h3>
              </div>
            </header>

            {removedPlaceIds.length > 0 && (
              <div className="removed-bar">
                <span>ตัดออกจากแผนแล้ว {removedPlaceIds.length} รายการ</span>
                <button type="button" onClick={() => setRemovedPlaceIds([])}>เอากลับทั้งหมด</button>
              </div>
            )}

            {/* เวลาเตะยังไม่ประกาศ = ตารางวันแข่งที่คิดถอยหลังจากเวลาเตะยังเชื่อไม่ได้
                ต้องบอกตรง ๆ ไม่ใช่ปล่อยให้ดูเหมือนแผนที่ใช้ได้จริง */}
            {fixture?.kickoffTimeAnnounced === false && (
              <div className="trip-warning" role="status">
                <TriangleAlert size={15} aria-hidden="true" />
                <span>
                  พรีเมียร์ลีกยังไม่ประกาศเวลาเตะของนัดนี้ — ตารางวันแข่งด้านล่างคิดจากเวลาชั่วคราว
                  ที่ผู้ให้บริการส่งมา ยังใช้อ้างอิงเวลาจริงไม่ได้ วันแข่งเชื่อได้ แต่เวลาต้องรอประกาศ
                </span>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="itinerary-issues">
                {conflicts.map((issue) => (
                  <p key={issue}><TriangleAlert size={13} aria-hidden="true" /> {issue}</p>
                ))}
              </div>
            )}

            <MatchdayCompanion
              itinerary={visibleItinerary}
              matchDate={matchDate}
              kickoffUtc={fixture?.kickoffUtc ?? null}
              venueName={fixture?.stadium ?? null}
              weather={weather}
            />
            <div className="itinerary-days">
              {visibleItinerary.map((day) => (
                <ItineraryDayCard
                  key={day.date}
                  day={day}
                  money={money}
                  onRemove={(placeId) => setRemovedPlaceIds((current) => [...new Set([...current, placeId])])}
                  partnersByKind={partnersByKind}
                  travellers={travellers}
                  tripId={savedTripId}
                />
              ))}
            </div>
            <VisaTripDocument
              itinerary={visibleItinerary}
              fixture={fixture}
              city={city}
              departDate={departDate}
              returnDate={returnDate}
              travellers={travellers}
              perPerson={estimate.perPerson}
              flight={selectedFlight
                ? { airline: selectedFlight.airline, route: `BKK → ${selectedFlight.arrivalCode}${selectedFlight.via ? ` (via ${selectedFlight.via})` : " (direct)"}` }
                : null}
              hotel={selectedHotel ? { name: selectedHotel.name, area: selectedHotel.area } : null}
            />
            <TripRequestPanel
              itinerary={visibleItinerary}
              partnersByKind={partnersByKind}
              travellers={travellers}
              matchLabel={fixture ? `${fixture.home} v ${fixture.away}` : ""}
              tripTitle={`ทริป ${length} วัน · ${city}`}
              departDate={departDate}
              returnDate={returnDate}
            />
            <p className="trip-disclaimer">
              เวลาในแผนเป็นเวลาอังกฤษ · จัดวันแข่งโดยถอยหลังจากเวลาเตะ เผื่อถึงสนามก่อน 75 นาที
              และเผื่อเวลาเดินทางจากโรงแรม {selectedHotel?.minutesToStadium ?? 30} นาที + สำรองอีก 15 นาที
              {Object.keys(partnersByKind).length > 0 && (
                <> · รายการที่มีปุ่ม <b>GOG</b> คือมีคนไทยในเครือข่ายรับงานนั้นได้ กดดูรายชื่อและส่งคำขอได้เลย</>
              )}
            </p>
          </section>

          {/* ── STEP 41 · วีซ่าอังกฤษ ────────────────────────────────────── */}
          <section className={`trip-block visa-block ${visaOpen ? "open" : "closed"}`} id="visa">
            <button
              type="button"
              className="visa-toggle"
              aria-expanded={visaOpen}
              onClick={() => setVisaOpen((current) => !current)}
            >
              <span className="visa-toggle-copy">
                <span className="eyebrow">STEP 6</span>
                <strong><Stamp size={15} aria-hidden="true" /> วีซ่าอังกฤษ · พาสปอร์ต · ใบขับขี่สากล</strong>
                <small>
                  {hasVisa(visa)
                    ? `เลือกไว้แล้ว ${visaLines.length} รายการ · ${money(visaTotalPerPerson)} ต่อคน`
                    : "กดเพื่อดูว่าต้องเตรียมอะไร ค่าใช้จ่ายเท่าไหร่ และต้องยื่นวันไหน"}
                </small>
              </span>
              <span className={`visa-toggle-icon ${visaOpen ? "open" : ""}`} aria-hidden="true">
                <ChevronDown size={17} />
              </span>
            </button>

            {visaOpen && (<>
            <p className="visa-lead">
              พาสปอร์ตไทยต้องขอ <b>Standard Visitor visa</b> ก่อนบินทุกครั้ง — ยื่นออนไลน์ที่ gov.uk
              แล้วไปเก็บลายนิ้วมือที่ศูนย์ VFS Global · เลือกระยะวีซ่าและบริการที่ต้องการ
              แล้วกด <b>+</b> เพื่อบวกเข้าค่าใช้จ่ายของทริปนี้
              <br />
              <b>{EVISA_NOTE}</b>
            </p>
            <p className="visa-fx" role="status">
              คิดเป็นบาทด้วยเรตปอนด์{fx.live ? "ล่าสุด" : "สำรอง"} <b>£1 = ฿{fx.rate}</b>
              {fx.date ? ` (${thaiDate(fx.date)})` : ""} · {fx.source}
              {fx.live ? " — อัปเดตอัตโนมัติ" : " — ดึงเรตจริงไม่สำเร็จ กำลังใช้ค่าสำรอง"}
            </p>

            <div className="visa-subhead">
              <strong>เลือกระยะวีซ่า</strong>
              <span>เข้าออกได้ไม่จำกัดครั้งตลอดอายุวีซ่า แต่ครั้งละไม่เกิน 6 เดือน</span>
            </div>
            <div className="visa-grid">
              {VISA_TYPES.map((type) => {
                const active = visa.typeId === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    className={`visa-card ${active ? "active" : ""}`}
                    aria-pressed={active}
                    onClick={() => pickVisaType(type.id)}
                  >
                    <span className="visa-add" aria-hidden="true">{active ? <Check size={13} /> : <Plus size={13} />}</span>
                    <span className="visa-card-name">{type.name}</span>
                    <span className="visa-card-tagline">{type.tagline}</span>
                    <p className="visa-card-detail">{type.bestFor}</p>
                    <span className="visa-card-price">
                      <b>{money(Math.round(type.feeGbp * fx.rate))}</b>
                      <small>£{type.feeGbp.toLocaleString("en-GB")} ต่อคน</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="visa-subhead">
              <strong>ยื่นแบบพิเศษ (lodge)</strong>
              <span>เลือกได้หลายอย่าง · Priority กับ Super Priority ซื้อพร้อมกันไม่ได้</span>
            </div>
            <div className="visa-grid">
              {LODGE_OPTIONS.map((option) => {
                const active = visa.lodgeIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`visa-card ${active ? "active" : ""}`}
                    aria-pressed={active}
                    onClick={() => toggleLodge(option.id)}
                  >
                    <span className="visa-add" aria-hidden="true">{active ? <Check size={13} /> : <Plus size={13} />}</span>
                    <span className="visa-card-name">{option.name}</span>
                    <span className="visa-provider">{option.provider}</span>
                    <p className="visa-card-detail">{option.detail}</p>
                    <span className="visa-card-price">
                      <b>{money(option.perGroup ? Math.round(lodgePriceThb(option, fx.rate) / Math.max(travellers, 1)) : lodgePriceThb(option, fx.rate))}</b>
                      <small>
                        {option.perGroup
                          ? `เหมา ${formatThb(lodgePriceThb(option, fx.rate))} หาร ${travellers} คน`
                          : option.feeGbp ? `£${option.feeGbp.toLocaleString("en-GB")} ต่อคน` : "ต่อคน"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>

            {visaPlan && (
              <div className={`visa-timing ${visaPlan.feasible ? "" : "late"}`}>
                <div>
                  <small>รอผลประมาณ</small>
                  <b>{visaPlan.workingDays} วันทำการ</b>
                </div>
                <div>
                  <small>ควรยื่นวันที่</small>
                  <b>{thaiDate(visaPlan.lodgeBy)}</b>
                </div>
                <div>
                  <small>ยื่นได้เร็วสุด</small>
                  <b>{thaiDate(visaPlan.earliest)}</b>
                </div>
              </div>
            )}

            <div className="visa-subhead">
              <strong>ขั้นแรก — ตอนนี้มีพาสปอร์ตแล้วหรือยัง?</strong>
              <span>ไม่มีเล่ม = ยื่นวีซ่าไม่ได้เลย ต้องเคลียร์เรื่องนี้ก่อนทุกอย่าง</span>
            </div>
            <div className="passport-gate">
              {([
                ["have", "มีแล้ว เหลืออายุเกิน 6 เดือน", "ข้ามไปเรื่องวีซ่าได้เลย"],
                ["expiring", "มีเล่ม แต่เหลือไม่ถึง 6 เดือน", "ต้องทำเล่มใหม่ก่อน อังกฤษไม่รับเล่มที่ใกล้หมดอายุ"],
                ["none", "ยังไม่มีเล่ม / เล่มหาย", "เริ่มจากทำพาสปอร์ตก่อน แล้วค่อยยื่นวีซ่า"],
              ] as Array<[PassportStatus, string, string]>).map(([value, label, hint]) => {
                const active = visa.passportStatus === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`passport-gate-option ${active ? "active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setVisa((current) => ({
                      ...current,
                      passportStatus: value,
                      // ตอบว่ามีเล่มแล้ว = ล้างตัวเลือกทำเล่มที่อาจเผลอกดไว้ก่อนหน้า
                      passportId: value === "have" ? null : current.passportId,
                    }))}
                  >
                    <span className="passport-gate-mark" aria-hidden="true">{active ? <Check size={12} /> : null}</span>
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            {visa.passportStatus === "have" && (
              <p className="passport-ok">
                <Check size={13} aria-hidden="true" /> พาสปอร์ตพร้อมแล้ว — ข้ามขั้นตอนทำเล่มไปได้เลย
                เหลือแค่เช็กว่าชื่อ-นามสกุลบนเล่มตรงกับที่จะกรอกในใบสมัครวีซ่าทุกตัวอักษร
              </p>
            )}

            {needsPassportWork(visa.passportStatus) && (<>
            <div className="visa-subhead">
              <strong>{visa.passportStatus === "none" ? "ทำพาสปอร์ตใหม่" : "ต่ออายุพาสปอร์ต"}</strong>
              <span>เลือกแบบเล่มที่จะทำ — ต้องได้เล่มก่อนถึงจะยื่นวีซ่าได้</span>
            </div>
            <div className="visa-grid">
              {PASSPORT_OPTIONS.map((option) => {
                const active = visa.passportId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`visa-card ${active ? "active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setVisa((current) => ({ ...current, passportId: active ? null : option.id }))}
                  >
                    <span className="visa-add" aria-hidden="true">{active ? <Check size={13} /> : <Plus size={13} />}</span>
                    <span className="visa-card-name">{option.name}</span>
                    <span className="visa-card-tagline">{option.turnaround}</span>
                    {option.note && <p className="visa-card-detail">{option.note}</p>}
                    <span className="visa-card-price">
                      <b>{money(option.priceThb)}</b>
                      <small>กรมการกงสุล · ต่อคน</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="visa-mini">
              <strong>เอกสารทำพาสปอร์ต</strong>
              <ul>
                {PASSPORT_DOCUMENTS.map((item) => (
                  <li key={item.label}><b>{item.label}</b> — {item.detail}</li>
                ))}
              </ul>
              <p>{PASSPORT_WHERE}</p>
            </div>
            </>)}

            <div className="visa-subhead">
              <strong>ใบขับขี่สากล</strong>
              <span>จะเช่ารถขับเองในอังกฤษหรือเปล่า</span>
            </div>
            <div className="visa-grid">
              {IDP_OPTIONS.map((option) => {
                const active = visa.idpId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`visa-card ${active ? "active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setVisa((current) => ({ ...current, idpId: active ? null : option.id }))}
                  >
                    <span className="visa-add" aria-hidden="true">{active ? <Check size={13} /> : <Plus size={13} />}</span>
                    <span className="visa-card-name">{option.name}</span>
                    <p className="visa-card-detail">{option.detail}</p>
                    <span className="visa-card-price">
                      <b>{money(option.priceThb)}</b>
                      <small>ต่อคน · อายุ 1 ปี</small>
                    </span>
                  </button>
                );
              })}
              <div className="visa-mini inline">
                <strong>เอกสารทำใบขับขี่สากล</strong>
                <ul>
                  {IDP_DOCUMENTS.map((item) => (
                    <li key={item.label}><b>{item.label}</b> — {item.detail}</li>
                  ))}
                </ul>
                <p>{IDP_WHERE}</p>
              </div>
            </div>
            <p className="visa-advice">{IDP_ADVICE}</p>

            <div className="visa-subhead gog">
              <strong>ให้ GOG VISA UK ทำให้</strong>
              <span>บริการเสริมของเราเอง · ไปกัน 4 คนขึ้นไปได้ส่วนลดกลุ่มอัตโนมัติ</span>
            </div>
            {/* ฮาโลไล่สีรอบทั้งบล็อก = ป้ายบอกว่านี่คือบริการที่ GOG ขายเอง
                ใส่ครอบทั้งกลุ่มครั้งเดียว ไม่ใส่ทีละใบ ไม่งั้นสามใบแย่งกันเด่น */}
            <BackgroundGradient className="visa-gog-halo">
            <div className="visa-grid gog-grid">
              {GOG_VISA_PACKAGES.map((pack) => {
                const active = visa.packageId === pack.id;
                const price = packagePricePerPerson(pack, travellers);
                return (
                  <button
                    key={pack.id}
                    type="button"
                    className={`visa-card gog-card ${active ? "active" : ""}`}
                    aria-pressed={active}
                    onClick={() => pickPackage(pack.id)}
                  >
                    <span className="visa-add" aria-hidden="true">{active ? <Check size={13} /> : <Plus size={13} />}</span>
                    <span className="visa-card-name">{pack.name}</span>
                    <span className="visa-card-tagline">{pack.tagline}</span>
                    <ul className="visa-includes">
                      {pack.includes.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                    <span className="visa-card-price">
                      <b>{money(price)}</b>
                      <small>{price < pack.priceThb ? `ลดกลุ่ม ${pack.groupDiscount}% แล้ว` : "ต่อคน"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            </BackgroundGradient>

            {hasVisa(visa) && (
              <>
                <div className="visa-subhead">
                  <strong>สรุปค่าใช้จ่ายเอกสาร</strong>
                  <span>แยกให้เห็นว่าอันไหนเป็นค่าธรรมเนียมราชการ อันไหนคือค่าดำเนินการที่เลือกจ่ายเอง</span>
                </div>
                <div className="visa-summary">
                  <div className="visa-summary-col">
                    <span className="visa-summary-tag gov">ค่าธรรมเนียมราชการ</span>
                    <p>จ่ายให้หน่วยงานรัฐ ไม่ว่าจะทำเองหรือจ้างใครทำก็เท่านี้ · ไม่คืนเงินทุกกรณี</p>
                    <ul>
                      {breakdown.passportGovernment > 0 && (
                        <li><span>ค่าทำพาสปอร์ตไทย</span><b>{money(breakdown.passportGovernment)}</b></li>
                      )}
                      {breakdown.visaGovernment > 0 && (
                        <li><span>ค่าธรรมเนียมวีซ่าอังกฤษ</span><b>{money(breakdown.visaGovernment)}</b></li>
                      )}
                      {breakdown.idpGovernment > 0 && (
                        <li><span>ค่าทำใบขับขี่สากล</span><b>{money(breakdown.idpGovernment)}</b></li>
                      )}
                      {breakdown.government === 0 && <li className="empty"><span>ยังไม่ได้เลือก</span><b>—</b></li>}
                    </ul>
                    <div className="visa-summary-total"><span>รวมค่าราชการ</span><b>{money(breakdown.government)}</b></div>
                  </div>

                  <div className="visa-summary-col">
                    <span className="visa-summary-tag svc">ค่าดำเนินการ</span>
                    <p>ค่าบริการที่เลือกจ่ายเพิ่มเอง · ตัดออกได้ทั้งหมดถ้ายอมรอคิวและทำเอกสารเอง</p>
                    <ul>
                      {breakdown.visaService > 0 && (
                        <li><span>บริการเร่ง / ยื่นแบบพิเศษ</span><b>{money(breakdown.visaService)}</b></li>
                      )}
                      {breakdown.gogService > 0 && (
                        <li className="gog"><span>GOG VISA UK</span><b>{money(breakdown.gogService)}</b></li>
                      )}
                      {breakdown.service === 0 && <li className="empty"><span>ทำเองทั้งหมด ไม่มีค่าบริการ</span><b>฿0</b></li>}
                    </ul>
                    <div className="visa-summary-total"><span>รวมค่าดำเนินการ</span><b>{money(breakdown.service)}</b></div>
                  </div>
                </div>

                <div className="visa-selected">
                  <span>รวมค่าเอกสารทั้งหมด {visaLines.length} รายการ — บวกในยอดทริปด้านขวาแล้ว</span>
                  <b>{money(breakdown.total)} ต่อคน</b>
                  <button type="button" onClick={() => setVisa(EMPTY_VISA)}>ล้างทั้งหมด</button>
                </div>
              </>
            )}

            {visaPlan && (
              <>
                <div className="visa-subhead">
                  <strong>การวางแผนการดำเนินงาน</strong>
                  <span>คิดถอยหลังจากวันบิน {thaiDate(departDate)} · ปรับเองอัตโนมัติเมื่อเปลี่ยนวันหรือบริการเร่ง</span>
                </div>

                <div className={`visa-anchor ${visaPlan.feasible ? "" : "blocked"}`}>
                  <div>
                    <small>ยื่นวีซ่าวันที่</small>
                    <b>{thaiDate(visaPlan.lodgeBy)}</b>
                    <em>ก่อนบิน {daysBetween(visaPlan.lodgeBy, departDate)} วัน</em>
                  </div>
                  <div>
                    <small>น่าจะรู้ผล</small>
                    <b>{thaiDate(visaPlan.decisionBy)}</b>
                    <em>รอ {visaPlan.workingDays} วันทำการ</em>
                  </div>
                  <div>
                    <small>ออกตั๋วเครื่องบิน + โรงแรม</small>
                    <b>{thaiDate(visaPlan.bookingBy)}</b>
                    <em>หลังผลออก 2 วัน</em>
                  </div>
                  <div>
                    <small>ออกเดินทาง</small>
                    <b>{thaiDate(departDate)}</b>
                    <em>{leave ? `ลางาน ${leave.leaveDays} วัน` : ""}</em>
                  </div>
                </div>

                {!visaPlan.feasible && (
                  <div className="trip-warning" role="status">
                    <TriangleAlert size={15} aria-hidden="true" />
                    <span>
                      วันบินนี้ยื่นไม่ทันแล้ว — ขาดไปประมาณ {visaPlan.shortfallDays} วัน
                      {visa.lodgeIds.includes("super")
                        ? " แม้ใช้ Super Priority ก็ยังไม่พอ ต้องเลื่อนวันเดินทาง"
                        : " ลองกดเพิ่ม Priority หรือ Super Priority ด้านบนเพื่อร่นเวลารอผล หรือเลื่อนวันบินออกไป"}
                    </span>
                  </div>
                )}

                <ol className="visa-plan">
                  {visaPlan.milestones.map((step) => {
                    const late = step.date < today;
                    return (
                      <li key={step.id} className={`${step.critical ? "critical" : ""} ${late ? "late" : ""}`}>
                        <span className="visa-plan-date">
                          <b>{thaiDate(step.date)}</b>
                          <small>{late ? "เลยกำหนดแล้ว" : `อีก ${Math.max(daysBetween(today, step.date), 0)} วัน`}</small>
                        </span>
                        <span className="visa-plan-body">
                          <strong>{step.title}</strong>
                          <p>{step.detail}</p>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            <div className="visa-subhead">
              <strong>ยื่นได้ที่ไหนบ้าง</strong>
              <span>ต้องไปด้วยตัวเองเพื่อเก็บลายนิ้วมือ — เลือกศูนย์ตอนจองคิว</span>
            </div>
            <div className="visa-centres">
              {VISA_CENTRES.map((centre) => (
                <article className="visa-centre" key={centre.id}>
                  <header>
                    <span className="visa-centre-city">{centre.city}</span>
                    <h5>{centre.building}</h5>
                  </header>
                  <p className="visa-centre-floor"><MapPin size={11} aria-hidden="true" /> {centre.floor}</p>
                  <p className="visa-centre-address">{centre.address}</p>
                  <p className="visa-centre-line"><b>เดินทาง</b> {centre.getThere}</p>
                  <p className="visa-centre-line"><b>เวลาทำการ</b> {centre.hours}</p>
                  {centre.note && <p className="visa-centre-note">{centre.note}</p>}
                  <a href={centre.mapUrl} target="_blank" rel="noreferrer">เปิดแผนที่</a>
                </article>
              ))}
            </div>

            <div className="visa-subhead">
              <strong>ขั้นตอนการยื่น</strong>
              <span>ค่าธรรมเนียมอัปเดตล่าสุด {thaiDate(FEES_UPDATED)} — ตรวจซ้ำที่ gov.uk ก่อนจ่ายจริง</span>
            </div>
            <ol className="visa-steps">
              {VISA_STEPS.map((step) => (
                <li key={step.title}>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="visa-subhead">
              <strong>eVisa ทำยังไง</strong>
              <span>ไม่มีสติกเกอร์ในเล่มแล้ว สถานะอยู่ออนไลน์ทั้งหมด</span>
            </div>
            <ol className="visa-steps evisa">
              {EVISA_STEPS.map((step) => (
                <li key={step.title}>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="visa-subhead">
              <strong>ลิงก์ที่ต้องใช้จริง</strong>
              <span>เปิดในแท็บใหม่ — ระวังเว็บปลอมที่คิดค่าบริการซ้ำซ้อน ของจริงลงท้าย gov.uk เท่านั้น</span>
            </div>
            <div className="visa-links">
              {VISA_LINKS.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                  <small>{new URL(link.url).hostname}</small>
                </a>
              ))}
            </div>

            <div className="visa-subhead">
              <strong>เอกสารที่ต้องเตรียม</strong>
              <span>ติ๊กแล้ว {checkedDocs.length} จาก {docCount} รายการ · บันทึกทริปแล้วเช็กลิสต์จะติดไปกับลิงก์แชร์</span>
            </div>
            <div className="visa-docs">
              {VISA_DOCUMENTS.map((group) => {
                const done = group.items.filter((_, index) => checkedDocs.includes(`${group.id}-${index}`)).length;
                return (
                  <section className="visa-doc-group" key={group.id}>
                    <h5>
                      {group.title}
                      <span className="visa-doc-count">{done}/{group.items.length}</span>
                    </h5>
                    {group.note && <p className="visa-doc-note">{group.note}</p>}
                    <ul className="visa-doc-list">
                      {group.items.map((item, index) => {
                        const key = `${group.id}-${index}`;
                        const checked = checkedDocs.includes(key);
                        return (
                          <li key={key} className={checked ? "done" : ""}>
                            <label className={`visa-doc-check ${checked ? "done" : ""}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleDoc(key)} />
                              <strong>
                                {item.label}
                                {item.fromTrip && <em className="visa-from-trip">ทริปนี้ออกให้</em>}
                              </strong>
                              <p>{item.detail}</p>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
            <p className="trip-disclaimer">
              GOG ไม่ใช่ตัวแทนของ UK Home Office และไม่รับประกันผลการพิจารณา — การอนุมัติเป็นดุลพินิจของเจ้าหน้าที่เท่านั้น
              ค่าธรรมเนียมรัฐไม่คืนเงินทุกกรณี · อย่าออกตั๋วเครื่องบินจริงก่อนวีซ่าออก
            </p>
            </>)}
          </section>

          {/* ── STEP 14 · Football Pilgrimage ────────────────────────────── */}
          {pilgrimage.length > 0 && (
            <section className="trip-block">
              <header className="trip-block-head">
                <div>
                  <span className="eyebrow">FOOTBALL PILGRIMAGE</span>
                  <h3><Landmark size={15} aria-hidden="true" /> หมุดที่แฟนบอลตัวจริงควรไป</h3>
                </div>
              </header>
              <div className="pilgrimage-list">
                {pilgrimage.map((place) => (
                  <article className="pilgrimage-card" key={place.id}>
                    <h4>{place.name}</h4>
                    <span className="pilgrimage-area"><MapPin size={11} aria-hidden="true" /> {place.area}</span>
                    <p>{place.significance ?? place.why}</p>
                    <div className="pilgrimage-meta">
                      <span>เผื่อเวลา {place.durationMinutes} นาที</span>
                      <span>{place.costThb === 0 ? "เข้าฟรี" : money(place.costThb)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── อากาศวันแข่ง (Open-Meteo) ────────────────────────────────── */}
          {weather && (
            <section className="trip-block weather-block">
              <header className="trip-block-head">
                <div>
                  <span className="eyebrow">MATCHDAY WEATHER</span>
                  <h3><CloudSun size={15} aria-hidden="true" /> อากาศวันแข่ง</h3>
                </div>
              </header>
              <div className="weather-row">
                <div className="weather-temp">
                  <strong>{weather.maxC}°</strong>
                  <span>ต่ำสุด {weather.minC}°</span>
                </div>
                <div className="weather-facts">
                  <span>{weather.summary}</span>
                  <span>โอกาสฝน {weather.rainChance}%</span>
                  <span>ลม {weather.windKph} กม./ชม.</span>
                </div>
              </div>
              <p className="weather-advice">{weather.advice}</p>
              <p className="trip-disclaimer">พยากรณ์จาก Open-Meteo · แม่นขึ้นเมื่อใกล้วันแข่ง ควรเช็กซ้ำก่อนออกเดินทาง</p>
            </section>
          )}

          {/* ── GOG Partner Network ───────────────────────────────────────── */}
          <section className="trip-block">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">GOG PARTNER NETWORK</span>
                <h3>คนไทยใน{city === "Manchester" ? "แมนเชสเตอร์" : "ลอนดอน"}ที่รับงานได้</h3>
              </div>
            </header>
            {rankedPartners.length === 0 ? (
              <p className="partner-empty">
                ยังไม่มีผู้ให้บริการที่ผ่านการตรวจในเมืองนี้ — ถ้าคุณอยู่อังกฤษและอยากรับงานกับ GOG
                ไปที่แท็บ &quot;เครือข่าย GOG&quot; เพื่อลงทะเบียน
              </p>
            ) : (
              <div className="partner-grid compact">
                {rankedPartners.map(({ partner, reasons }) => (
                  <article className="partner-card" key={partner.id}>
                    <header>
                      <span className="partner-kind">{PARTNER_KIND_LABEL[partner.kind]}</span>
                    </header>
                    <h4>{partner.displayName}</h4>
                    {partner.vehicle && (
                      <p className="partner-vehicle">{partner.vehicle.make} {partner.vehicle.model} · {partner.vehicle.seats} ที่นั่ง</p>
                    )}
                    <ul className="partner-reasons">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    {fromPrice(partner) > 0 && <span className="partner-from">เริ่มต้น {formatThb(fromPrice(partner))}</span>}
                  </article>
                ))}
              </div>
            )}
            <p className="trip-disclaimer">
              GOG เป็นไดเรกทอรี — ผู้เดินทางตกลงเงื่อนไขและชำระเงินกับผู้ให้บริการโดยตรง
            </p>
          </section>

          {/* ── STEP 39 · ASK GOG ────────────────────────────────────────── */}
          <section className="trip-block ask-gog">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">AI CONCIERGE</span>
                <h3><Sparkles size={15} aria-hidden="true" /> ASK GOG</h3>
              </div>
            </header>
            <p className="ask-gog-lead">บอกสิ่งที่อยากได้เป็นภาษาคนปกติ — ผู้ช่วยจะแก้ทริปให้จริง ไม่ใช่แค่ตอบกลับ</p>
            <div className="ask-gog-suggestions">
              {[
                "ทำทริปนี้ให้ถูกลง",
                "อยากได้ประวัติศาสตร์บอลเยอะกว่านี้",
                "ผมชอบกาแฟ specialty",
                "ขอไปแบบ 8 วันแทน",
                "หาโรงแรมใกล้สนามกว่านี้",
                "ขอร้านอาหารไทยเพิ่ม",
              ].map((prompt) => (
                <button key={prompt} type="button" disabled={assistantBusy} onClick={() => askGog(prompt)}>{prompt}</button>
              ))}
            </div>
            <form
              className="ask-gog-form"
              onSubmit={(event) => { event.preventDefault(); askGog(assistantQuestion); }}
            >
              <input
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
                placeholder="เช่น ไม่อยากตื่นเช้า อยากดูบอลสองนัด"
                disabled={assistantBusy}
              />
              <button type="submit" disabled={assistantBusy || !assistantQuestion.trim()}>
                <Wand2 size={13} aria-hidden="true" /> {assistantBusy ? "กำลังปรับทริป…" : "ปรับทริปให้"}
              </button>
            </form>
            {assistantReply && (
              <div className="ask-gog-reply">
                <p>{assistantReply.reply}</p>
                {assistantReply.changed.length > 0 && (
                  <>
                    <span className="ask-gog-changed-label">สิ่งที่เปลี่ยนไป</span>
                    <ul>{assistantReply.changed.map((line) => <li key={line}>{line}</li>)}</ul>
                  </>
                )}
              </div>
            )}
            {tripError && <p className="ask-gog-error">{tripError}</p>}
          </section>

          {/* ── STEP 24 · What if? ───────────────────────────────────────── */}
          <section className="trip-block">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">STEP 24</span>
                <h3>ถ้าเปลี่ยนแบบนี้ ราคาขยับเท่าไหร่?</h3>
              </div>
            </header>
            <div className="whatif-grid">
              {whatIfs.map((option) => (
                <button key={option.label} type="button" className="whatif-card" onClick={option.apply} disabled={!option.apply}>
                  <span>{option.label}</span>
                  <b className={option.delta > 0 ? "up" : option.delta < 0 ? "down" : ""}>
                    {option.delta === 0 ? "เท่าเดิม" : `${option.delta > 0 ? "+" : "−"}${money(Math.abs(option.delta))}`}
                  </b>
                </button>
              ))}
            </div>
          </section>

          {/* ── STEP 6 · แจกแจงค่าใช้จ่าย ────────────────────────────────── */}
          <section className="trip-block">
            <header className="trip-block-head">
              <div>
                <span className="eyebrow">STEP 5</span>
                <h3>ค่าใช้จ่ายโดยประมาณ</h3>
              </div>
            </header>
            <div className="cost-lines">
              {estimate.lines.map((line) => (
                <div className="cost-line" key={line.key}>
                  <div className="cost-line-head">
                    <span>{line.label}</span>
                    <b>{money(line.amount)}</b>
                  </div>
                  <div className="cost-line-bar"><i style={{ width: `${(line.amount / maxLine) * 100}%` }} /></div>
                  {line.note && <small>{line.note}</small>}
                </div>
              ))}
            </div>
            <p className="trip-disclaimer">
              ราคาทั้งหมดเป็นการประมาณการเพื่อวางแผนเท่านั้น อาจเปลี่ยนตามวันเดินทาง ที่ว่าง และเวลาที่จอง — ยังไม่ได้เชื่อมระบบจองจริง
            </p>
          </section>
        </div>

        {/* ── STEP 25 · แผงสรุปทริป ──────────────────────────────────────── */}
        <aside className="trip-summary" aria-label="สรุปทริป">
          <div className="trip-summary-inner">
            <span className="eyebrow">TRIP SUMMARY</span>
            {fixture ? (
              <>
                <h4>{fixture.home} v {fixture.away}</h4>
                <p className="trip-summary-sub">{fixture.stadium} · {fixture.city}</p>
              </>
            ) : (
              <h4>ยังไม่ได้เลือกแมตช์</h4>
            )}
            <dl>
              <div><dt>เดินทาง</dt><dd>{thaiDate(departDate)} – {thaiDate(returnDate)}</dd></div>
              <div><dt>ระยะเวลา</dt><dd>{length} วัน · {nights} คืน</dd></div>
              <div><dt>ผู้เดินทาง</dt><dd>{travellers} คน</dd></div>
              <div><dt>สไตล์</dt><dd>{BUDGET_LABELS[budget].name}</dd></div>
              <div><dt>ไฟลต์</dt><dd>{selectedFlight ? `${selectedFlight.airline} → ${selectedFlight.arrivalCode}` : "—"}</dd></div>
              <div><dt>ที่พัก</dt><dd>{selectedHotel ? selectedHotel.area : "—"}</dd></div>
              {leave && <div><dt>วันลา</dt><dd>{leave.leaveDays} วัน (จาก {leave.totalDays} วัน)</dd></div>}
              {breakdown.passportGovernment > 0 && (
                <div><dt>พาสปอร์ต</dt><dd>{money(breakdown.passportGovernment)}</dd></div>
              )}
              <div>
                <dt>วีซ่าอังกฤษ</dt>
                <dd>{breakdown.visaGovernment > 0 ? money(breakdown.visaGovernment) : "ยังไม่ได้เพิ่ม"}</dd>
              </div>
              {breakdown.service > 0 && (
                <div><dt>ค่าดำเนินการ</dt><dd>{money(breakdown.service)}</dd></div>
              )}
            </dl>
            <div className="trip-total">
              <span>รวมโดยประมาณ</span>
              <strong>{money(estimate.perPerson)}</strong>
              <small>ต่อคน · ทั้งกลุ่ม {money(estimate.total)}</small>
            </div>
            <a className="trip-cta" href="#itinerary">
              ดูแผนเที่ยว {length} วัน <Ticket size={14} aria-hidden="true" />
            </a>
            <button type="button" className="trip-save" onClick={saveTrip} disabled={saving}>
              <Share2 size={13} aria-hidden="true" /> {saving ? "กำลังบันทึก…" : "บันทึก + คัดลอกลิงก์แชร์"}
            </button>
            {shareUrl && <p className="trip-share-url">คัดลอกลิงก์แล้ว: <code>{shareUrl}</code></p>}
            <p className="trip-summary-note">
              ราคาเป็นการประมาณการเพื่อวางแผน ยังไม่ได้เชื่อมระบบจองจริง
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
