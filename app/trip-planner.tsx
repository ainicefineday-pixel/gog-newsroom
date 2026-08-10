"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Coins,
  Hotel,
  MapPin,
  Plane,
  TriangleAlert,
  Users,
} from "lucide-react";
import { listPlannableFixtures, recommendTripDates, hotelNights, type PlannableFixture } from "@/services/football/fixtures";
import { ARRIVAL_AIRPORTS, BANGKOK, arrivalWarning, listFlights, type FlightSort } from "@/services/flights";
import { defaultHotel, listHotels } from "@/services/hotels";
import { estimateTrip, formatMoney } from "@/services/pricing";
import { BUDGET_LABELS, type BudgetStyle, type DestinationCity, type TripLength } from "@/services/trip/types";

const BUDGET_ORDER: BudgetStyle[] = ["saver", "comfort", "premium"];

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

export function TripPlanner() {
  const fixtures = useMemo(() => listPlannableFixtures(), []);
  const [fixtureKey, setFixtureKey] = useState<string>(() => fixtures[0]?.key ?? "");
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

  const estimate = useMemo(() => estimateTrip({
    length,
    nights,
    city,
    budget,
    travellers,
    flightFare: selectedFlight?.estimatedFare[budget] ?? 0,
    hotelNightly: selectedHotel?.nightlyThb ?? 0,
    includeMatch: Boolean(fixture),
  }), [length, nights, city, budget, travellers, selectedFlight, selectedHotel, fixture]);

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
      }),
    };
  }), [airportsForCity, city, length, nights, travellers, fixture]);

  const arrivalDate = departDate ? addDays(departDate, selectedFlight?.arrivesMorning ? 1 : 1) : "";
  const warning = arrivalDate ? arrivalWarning(arrivalDate, matchDate) : null;

  const visibleFixtures = fixtures.filter((item) => {
    if (cityFilter !== "All" && item.destination !== cityFilter) return false;
    if (venueFilter === "home" && !item.isHome) return false;
    if (venueFilter === "away" && item.isHome) return false;
    return true;
  });

  const money = (amount: number) => formatMoney(amount, currency);
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
              {([5, 8] as TripLength[]).map((value) => (
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

            <div className="fixture-grid">
              {visibleFixtures.slice(0, 12).map((item) => {
                const recommended = recommendTripDates(item.kickoffUtc, length);
                const active = item.key === fixtureKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`trip-fixture ${active ? "active" : ""} ${item.city === "Manchester" ? "manchester" : ""}`}
                    onClick={() => setFixtureKey(item.key)}
                  >
                    <span className="trip-fixture-md">MW {item.matchday}</span>
                    <strong>{item.home}</strong>
                    <em>v</em>
                    <strong>{item.away}</strong>
                    <span className="trip-fixture-when">{ukKickoff(item)} <small>เวลาอังกฤษ</small></span>
                    <span className="trip-fixture-when">{thaiKickoff(item)} น. <small>เวลาไทย</small></span>
                    <span className="trip-fixture-venue">{item.stadium} · {item.city}</span>
                    <span className="trip-fixture-rec">แนะนำเดินทาง {thaiDate(recommended.departDate)} – {thaiDate(recommended.returnDate)}</span>
                    <span className={`trip-fixture-status ${item.status}`}>{item.status === "confirmed" ? "ยืนยันเวลาแล้ว" : "เวลาอาจเปลี่ยน"}</span>
                  </button>
                );
              })}
            </div>
            <p className="trip-disclaimer">
              วันและเวลาแข่งของพรีเมียร์ลีกเปลี่ยนได้จากการถ่ายทอดสดหรือรายการอื่น — ตรวจสอบอีกครั้งก่อนจองตั๋วที่คืนเงินไม่ได้
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
                    <span>{hotel.area} · {"★".repeat(hotel.stars)}</span>
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
            </dl>
            <div className="trip-total">
              <span>รวมโดยประมาณ</span>
              <strong>{money(estimate.perPerson)}</strong>
              <small>ต่อคน · ทั้งกลุ่ม {money(estimate.total)}</small>
            </div>
            <button type="button" className="trip-cta">
              สร้างแผนเที่ยวรายวัน <ArrowRight size={14} aria-hidden="true" />
            </button>
            <p className="trip-summary-note">แผนเที่ยวรายวัน (ไอเทนเนอรารี 5/8 วัน) กำลังพัฒนาในเฟสถัดไป</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
