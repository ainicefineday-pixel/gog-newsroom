"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MU_PREMIER_LEAGUE_FIXTURES, type MuFixture } from "@/config/mu-fixtures";
import { STADIUM_LOCATIONS, type StadiumLocation } from "@/config/stadium-locations";
import {
  getStadiumTravelPlan,
  NATIONAL_RAIL_TIMETABLE_GUIDANCE,
  totalTravelMinutes,
  type StadiumTravelPlan,
} from "@/config/stadium-travel";

// England fits six grounds inside Greater London, so at country zoom their pins
// collapse into one unreadable stack. Below SPREAD_MAX_ZOOM any pins that would
// overlap are fanned onto a small ring; zooming in restores exact positions.
const SPREAD_MAX_ZOOM = 9;
const COLLIDE_PX = 44;
const SPREAD_RADIUS_PX = 34;

function formatMapFixture(fixture: MuFixture) {
  const date = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(fixture.kickoffUtc));
  const time = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(fixture.kickoffUtc));
  return `${date} · ${time} น. ไทย`;
}

function venueFixtures(stadium: string) {
  return MU_PREMIER_LEAGUE_FIXTURES.filter((fixture) => fixture.stadium === stadium);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} นาที`;
  return remainder ? `${hours} ชม. ${remainder} นาที` : `${hours} ชม.`;
}

function formatUkTravelTime(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function ukDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function travelWindow(fixture: MuFixture, plan: StadiumTravelPlan) {
  const doorToDoor = totalTravelMinutes(plan);
  const kickoff = new Date(fixture.kickoffUtc);
  const arriveGround = new Date(kickoff.getTime() - 120 * 60_000);
  const leaveManchester = new Date(arriveGround.getTime() - doorToDoor * 60_000);
  const boardReturn = new Date(kickoff.getTime() + 150 * 60_000);
  const arriveManchester = new Date(boardReturn.getTime() + doorToDoor * 60_000);
  return {
    kickoff,
    arriveGround,
    leaveManchester,
    boardReturn,
    arriveManchester,
    overnight: ukDateKey(kickoff) !== ukDateKey(arriveManchester),
  };
}

// Fans out pins that would otherwise stack, so every ground stays clickable.
function layoutMarkers(
  Leaflet: typeof import("leaflet"),
  map: import("leaflet").Map,
  markers: Map<string, import("leaflet").Marker>,
) {
  const zoom = map.getZoom();
  const settle = (location: StadiumLocation) =>
    markers.get(location.club)?.setLatLng([location.latitude, location.longitude]);

  if (zoom >= SPREAD_MAX_ZOOM) {
    STADIUM_LOCATIONS.forEach(settle);
    return;
  }

  const placed = STADIUM_LOCATIONS.map((location) => ({
    location,
    point: map.project([location.latitude, location.longitude], zoom),
  }));

  const clusters: Array<typeof placed> = [];
  for (const entry of placed) {
    const cluster = clusters.find((candidate) =>
      candidate.some((member) => member.point.distanceTo(entry.point) < COLLIDE_PX),
    );
    if (cluster) cluster.push(entry);
    else clusters.push([entry]);
  }

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      settle(cluster[0].location);
      continue;
    }
    const centreX = cluster.reduce((sum, member) => sum + member.point.x, 0) / cluster.length;
    const centreY = cluster.reduce((sum, member) => sum + member.point.y, 0) / cluster.length;
    const radius = cluster.length > 4 ? SPREAD_RADIUS_PX * 1.4 : SPREAD_RADIUS_PX;
    cluster.forEach((member, index) => {
      const angle = (index / cluster.length) * Math.PI * 2 - Math.PI / 2;
      const ring = Leaflet.point(centreX + Math.cos(angle) * radius, centreY + Math.sin(angle) * radius);
      markers.get(member.location.club)?.setLatLng(map.unproject(ring, zoom));
    });
  }
}

function markerIcon(Leaflet: typeof import("leaflet"), location: StadiumLocation, selected: boolean) {
  const isHome = location.club === "Manchester United";
  return Leaflet.divIcon({
    className: "gog-map-marker-shell",
    html: `<span class="gog-map-marker${isHome ? " home" : ""}${selected ? " selected" : ""}"><b>${location.code}</b></span>`,
    iconSize: [46, 54],
    iconAnchor: [23, 50],
  });
}

export function StadiumMapPanel() {
  const [selectedClub, setSelectedClub] = useState("Manchester United");
  const [selectedTravelMatchday, setSelectedTravelMatchday] = useState<number | null>(null);
  // On phones the map starts locked so a finger drag scrolls the page, not the map.
  const [touchDevice, setTouchDevice] = useState(false);
  const [mapUnlocked, setMapUnlocked] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerRefs = useRef(new Map<string, import("leaflet").Marker>());
  const selected = STADIUM_LOCATIONS.find((location) => location.club === selectedClub) ?? STADIUM_LOCATIONS[0];
  const fixtures = useMemo(() => venueFixtures(selected.stadium), [selected.stadium]);
  const selectedTravelFixture = fixtures.find((fixture) => fixture.matchday === selectedTravelMatchday) ?? fixtures[0];
  const travelPlan = getStadiumTravelPlan(selected.stadium);
  const recommendedWindow = selectedTravelFixture && travelPlan ? travelWindow(selectedTravelFixture, travelPlan) : null;

  useEffect(() => {
    let active = true;
    const markers = new Map<string, import("leaflet").Marker>();
    async function createMap() {
      if (!mapContainerRef.current || mapRef.current) return;
      const Leaflet = await import("leaflet");
      if (!active || !mapContainerRef.current) return;
      leafletRef.current = Leaflet;
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      setTouchDevice(coarsePointer);
      const map = Leaflet.map(mapContainerRef.current, {
        center: [53.25, -1.35],
        zoom: 6,
        minZoom: 5,
        maxZoom: 17,
        zoomControl: false,
        scrollWheelZoom: false,
        // A locked map lets the page scroll past it on touch screens.
        dragging: !coarsePointer,
      });
      Leaflet.control.zoom({ position: "topright" }).addTo(map);
      Leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        detectRetina: false,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const bounds = Leaflet.latLngBounds([]);
      markerRefs.current = markers;
      for (const location of STADIUM_LOCATIONS) {
        const point = Leaflet.latLng(location.latitude, location.longitude);
        bounds.extend(point);
        const marker = Leaflet.marker(point, {
          icon: markerIcon(Leaflet, location, location.club === "Manchester United"),
          title: `${location.stadium} · ${location.club}`,
          keyboard: true,
        }).addTo(map);
        marker.on("click", () => {
          setSelectedClub(location.club);
          setSelectedTravelMatchday(null);
        });
        markers.set(location.club, marker);
      }
      map.fitBounds(bounds, { padding: [38, 38] });
      map.on("zoomend", () => layoutMarkers(Leaflet, map, markers));
      layoutMarkers(Leaflet, map, markers);
      mapRef.current = map;
      window.setTimeout(() => {
        map.invalidateSize();
        layoutMarkers(Leaflet, map, markers);
      }, 80);
    }
    void createMap();
    return () => {
      active = false;
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const Leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!Leaflet || !map) return;
    for (const location of STADIUM_LOCATIONS) {
      markerRefs.current.get(location.club)?.setIcon(markerIcon(Leaflet, location, location.club === selectedClub));
    }
    map.flyTo([selected.latitude, selected.longitude], selected.city === "London" ? 11 : 10, { duration: 0.7 });
  }, [selected, selectedClub]);

  useEffect(() => {
    if (!mapUnlocked) return;
    mapRef.current?.dragging.enable();
  }, [mapUnlocked]);

  const chooseStadium = (location: StadiumLocation) => {
    setSelectedClub(location.club);
    setSelectedTravelMatchday(null);
  };

  return (
    <section className="stadium-map-view" id="stadium-map" aria-labelledby="stadium-map-heading">
      <div className="map-hero">
        <div>
          <span className="eyebrow">GOG AWAY DAY INTELLIGENCE · 2026/27</span>
          <h2 id="stadium-map-heading">แผนที่สมรภูมิทั่วอังกฤษ</h2>
          <p>ปักหมุดครบทุกสนามในเส้นทางพรีเมียร์ลีกของแมนเชสเตอร์ ยูไนเต็ด</p>
        </div>
        <div className="map-hero-stats">
          <span><b>{STADIUM_LOCATIONS.length}</b> สนาม</span>
          <span><b>38</b> นัด</span>
          <span><b>1</b> ภารกิจ</span>
        </div>
      </div>

      <div className="stadium-map-layout">
        <div className="map-stage">
          <div ref={mapContainerRef} className="leaflet-stadium-map" role="application" aria-label="แผนที่สนามพรีเมียร์ลีกในอังกฤษ" />
          {touchDevice && !mapUnlocked && (
            <button type="button" className="map-unlock" onClick={() => setMapUnlocked(true)}>
              แตะเพื่อเลื่อนแผนที่
              <small>ล็อกไว้เพื่อให้เลื่อนหน้าเว็บผ่านได้</small>
            </button>
          )}
          <div className="map-key"><span><i className="home" /> Old Trafford</span><span><i /> สนามเยือน</span><small>หมุดที่ซ้อนกันถูกกางออกให้กดได้ · ซูมเข้าเพื่อดูตำแหน่งจริง</small></div>
          <span className="map-watermark" aria-hidden="true">GOG<br /><small>ROAD TO GLORY</small></span>
        </div>

        <aside className="stadium-map-sidebar">
          <div className="selected-stadium-card">
            <span className="selected-stadium-code">{selected.code}</span>
            <div>
              <small>{selected.club === "Manchester United" ? "HOME OF THE RED DEVILS" : "AWAY DESTINATION"}</small>
              <h3>{selected.stadium}</h3>
              <p>{selected.club} · {selected.city}</p>
            </div>
            <a href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=16/${selected.latitude}/${selected.longitude}`} target="_blank" rel="noreferrer" aria-label={`เปิด ${selected.stadium} ใน OpenStreetMap`}>↗</a>
          </div>

          <div className="stadium-fixture-list">
            <span>แมตช์ที่สนามนี้ · เวลาไทย</span>
            {fixtures.slice(0, 4).map((fixture) => (
              <article key={`${fixture.matchday}-${fixture.kickoffUtc}`}>
                <b>MW {String(fixture.matchday).padStart(2, "0")}</b>
                <div><strong>{fixture.home}</strong><i>v</i><strong>{fixture.away}</strong><small>{formatMapFixture(fixture)}</small></div>
                <em className={fixture.status}>{fixture.status === "confirmed" ? "ยืนยัน" : "รอยืนยัน"}</em>
              </article>
            ))}
            {fixtures.length > 4 && <small className="more-fixtures">และอีก {fixtures.length - 4} นัดที่ Old Trafford — ดูทั้งหมดในแท็บโปรแกรม</small>}
          </div>

          {travelPlan && selectedTravelFixture && recommendedWindow && (
            <section className="rail-travel-card" aria-labelledby="rail-travel-heading">
              <div className="rail-travel-heading">
                <div>
                  <span>{travelPlan.mode === "tram" ? "MANCHESTER TRAM PLAN" : "TRAIN FROM MANCHESTER"}</span>
                  <h3 id="rail-travel-heading">แผนเดินทางไปสนาม</h3>
                </div>
                <i aria-hidden="true">↗</i>
              </div>

              <div className="rail-travel-metrics">
                <span><small>ระยะทางตามเส้นทาง{travelPlan.mode === "tram" ? "รถราง" : "รถไฟ"}</small><b>≈ {travelPlan.distanceKm} กม.</b></span>
                <span><small>{travelPlan.mode === "tram" ? "นั่งรถราง" : "นั่งรถไฟ"} · สถานีถึงสถานี</small><b>≈ {formatDuration(travelPlan.railMinutes)}</b></span>
                <span><small>จากสถานีปลายทางถึงสนาม</small><b>≈ {formatDuration(travelPlan.lastMileMinutes)}</b></span>
                <span className="metric-total"><small>รวมประตูถึงประตู</small><b>≈ {formatDuration(totalTravelMinutes(travelPlan))}</b></span>
              </div>

              {fixtures.length > 1 && (
                <label className="travel-fixture-select">
                  <span>เลือกนัดเพื่อคำนวณเวลา</span>
                  <select
                    value={selectedTravelFixture.matchday}
                    onChange={(event) => setSelectedTravelMatchday(Number(event.target.value))}
                  >
                    {fixtures.map((fixture) => (
                      <option key={fixture.matchday} value={fixture.matchday}>
                        MW {fixture.matchday} · {fixture.home} v {fixture.away}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="rail-route" aria-label="สถานีและเส้นทางแนะนำ">
                {travelPlan.via.map((stop, index) => (
                  <div key={`${stop}-${index}`}>
                    <i className={index === 0 || index === travelPlan.via.length - 1 ? "terminal" : ""} aria-hidden="true" />
                    <span><small>{index === 0 ? "เริ่ม" : index === travelPlan.via.length - 1 ? "ลง" : "เปลี่ยน/ผ่าน"}</small><b>{stop}</b></span>
                  </div>
                ))}
              </div>

              <p className="rail-last-mile"><b>จากสถานีถึงสนาม:</b> {travelPlan.lastMile}</p>

              <div className="travel-time-window">
                <div className="travel-time-window-title">
                  <span>เวลาเป้าหมาย · เวลาท้องถิ่นอังกฤษ</span>
                  <b>MW {String(selectedTravelFixture.matchday).padStart(2, "0")}</b>
                </div>
                <div className="travel-time-grid">
                  <span><small>ออกจาก Manchester</small><b>{formatUkTravelTime(recommendedWindow.leaveManchester)}</b></span>
                  <span><small>ถึงย่านสนาม</small><b>{formatUkTravelTime(recommendedWindow.arriveGround)}</b></span>
                  <span><small>เป้าหมายขึ้นเที่ยวกลับ</small><b>{formatUkTravelTime(recommendedWindow.boardReturn)}</b></span>
                  <span><small>ถึง Manchester โดยประมาณ</small><b>{formatUkTravelTime(recommendedWindow.arriveManchester)}</b></span>
                </div>
              </div>

              {(recommendedWindow.overnight || selectedTravelFixture.status === "provisional" || travelPlan.note) && (
                <div className="travel-alerts">
                  {recommendedWindow.overnight && <p className="overnight"><b>!</b> มีโอกาสกลับ Manchester ในคืนเดียวกันไม่ได้ ควรตรวจเที่ยวสุดท้ายและเตรียมแผนค้างคืน</p>}
                  {selectedTravelFixture.status === "provisional" && <p><b>i</b> เวลาแข่งยังรอยืนยัน แผนนี้จะคำนวณใหม่เมื่อเวลาแข่งขันเปลี่ยน</p>}
                  {travelPlan.note && <p><b>i</b> {travelPlan.note}</p>}
                </div>
              )}

              <div className="rail-planner-actions">
                <a href={travelPlan.plannerUrl} target="_blank" rel="noreferrer">ตรวจเที่ยวจริง ↗</a>
                <a href={NATIONAL_RAIL_TIMETABLE_GUIDANCE} target="_blank" rel="noreferrer">เกณฑ์ยืนยันตารางรถไฟ ↗</a>
              </div>
              <small className="travel-disclaimer">ตัวเลขทั้งหมดเป็นค่าเฉลี่ยนอกชั่วโมงเร่งด่วนสำหรับวางแผนคร่าวๆ ไม่ใช่เวลาเที่ยวรถที่ยืนยัน · กดปุ่มตรวจเที่ยวจริงทุกครั้งก่อนเดินทาง · ตารางรถไฟปกติยืนยันราว 12 สัปดาห์ล่วงหน้า</small>
            </section>
          )}

          <div className="stadium-picker" aria-label="เลือกรายชื่อสนาม">
            <div><span>เลือกสนาม</span><small>{selected.city}</small></div>
            <div className="stadium-picker-list">
              {STADIUM_LOCATIONS.map((location, index) => (
                <button key={location.club} type="button" className={location.club === selectedClub ? "active" : ""} onClick={() => chooseStadium(location)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><b>{location.stadium}</b><small>{location.club} · {location.city}</small></div>
                  <i>⌖</i>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <p className="map-data-note">แผนที่ © OpenStreetMap contributors · โปรแกรมและเวลาแข่งขันอาจเปลี่ยนตามประกาศพรีเมียร์ลีก</p>
    </section>
  );
}
