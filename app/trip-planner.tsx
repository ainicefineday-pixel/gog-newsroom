"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Coins,
  Hotel,
  Landmark,
  MapPin,
  Plane,
  CloudSun,
  Share2,
  Sparkles,
  Ticket,
  TriangleAlert,
  Users,
  Wand2,
} from "lucide-react";
import { listPlannableFixtures, recommendTripDates, hotelNights, type PlannableFixture } from "@/services/football/fixtures";
import { ARRIVAL_AIRPORTS, BANGKOK, arrivalWarning, listFlights, type FlightSort } from "@/services/flights";
import { defaultHotel, listHotels } from "@/services/hotels";
import { estimateTrip, formatMoney } from "@/services/pricing";
import { buildItinerary, detectConflicts, type ItineraryDay } from "@/services/itinerary";
import { pilgrimageIn, PLACES } from "@/services/places";
import { PARTNER_KIND_LABEL, fromPrice, rankPartners } from "@/services/partners";
import type { Partner } from "@/lib/server/partners";
import type { MatchWeather } from "@/services/weather";
import { formatThb } from "@/services/pricing";
import { FLIGHT_OPTIONS } from "@/services/flights";
import { HOTEL_OPTIONS } from "@/services/hotels";
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

function ItineraryDayCard({ day, money, onRemove }: {
  day: ItineraryDay;
  money: (amount: number) => string;
  onRemove: (placeId: string) => void;
}) {
  return (
    <article className={`itinerary-day ${day.theme}`}>
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
        {day.items.map((item, index) => (
          <li key={`${item.time}-${index}`} className={item.highlight ? "highlight" : ""}>
            <time>{item.time}</time>
            <div>
              <strong>{item.title}{item.booking ? <em className="need-booking">ต้องจองล่วงหน้า</em> : null}</strong>
              <p>{item.detail}</p>
              <small>
                {item.area ? `${item.area} · ` : ""}
                ใช้เวลา {item.durationMinutes} นาที
                {item.costThb > 0 ? ` · ${money(item.costThb)}` : " · ไม่มีค่าใช้จ่าย"}
              </small>
              {item.placeId && (
                <button type="button" className="item-remove" onClick={() => onRemove(item.placeId!)}>
                  ตัดออกจากแผน
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
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
  const [removedPlaceIds, setRemovedPlaceIds] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantReply, setAssistantReply] = useState<{ reply: string; changed: string[] } | null>(null);
  const [tripError, setTripError] = useState("");
  const [weather, setWeather] = useState<MatchWeather | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);

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

  // ── STEP 11/12/21 · แผนเที่ยวรายวัน ─────────────────────────────────
  const itineraryInput = {
    city,
    departDate,
    length,
    matchDate,
    kickoffUtc: fixture?.kickoffUtc ?? null,
    stadium: fixture?.stadium ?? null,
    minutesToStadium: selectedHotel?.minutesToStadium ?? 30,
    arrivesMorning: selectedFlight?.arrivesMorning ?? false,
  };
  const itinerary = useMemo(
    () => (departDate ? buildItinerary(itineraryInput) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city, departDate, length, matchDate, fixture?.kickoffUtc, fixture?.stadium, selectedHotel?.minutesToStadium, selectedFlight?.arrivesMorning],
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
    removedPlaceIds,
  }), [fixtureKey, length, budget, travellers, currency, departDate, returnDate, selectedFlight?.id, selectedHotel?.id, removedPlaceIds]);

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
        if (saved.departDate && saved.returnDate) {
          setDateOverride({ sig: `${saved.fixtureKey}-${saved.length}`, depart: saved.departDate, back: saved.returnDate });
        }
      })
      .catch(() => { /* ลิงก์เสีย = เริ่มวางแผนใหม่ตามปกติ */ });
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

            {conflicts.length > 0 && (
              <div className="itinerary-issues">
                {conflicts.map((issue) => (
                  <p key={issue}><TriangleAlert size={13} aria-hidden="true" /> {issue}</p>
                ))}
              </div>
            )}

            <div className="itinerary-days">
              {visibleItinerary.map((day) => (
                <ItineraryDayCard
                  key={day.date}
                  day={day}
                  money={money}
                  onRemove={(placeId) => setRemovedPlaceIds((current) => [...new Set([...current, placeId])])}
                />
              ))}
            </div>
            <p className="trip-disclaimer">
              เวลาในแผนเป็นเวลาอังกฤษ · จัดวันแข่งโดยถอยหลังจากเวลาเตะ เผื่อถึงสนามก่อน 75 นาที
              และเผื่อเวลาเดินทางจากโรงแรม {selectedHotel?.minutesToStadium ?? 30} นาที + สำรองอีก 15 นาที
            </p>
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
