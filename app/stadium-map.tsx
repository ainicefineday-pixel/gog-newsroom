"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MU_PREMIER_LEAGUE_FIXTURES, type MuFixture } from "@/config/mu-fixtures";
import { STADIUM_LOCATIONS, type StadiumLocation } from "@/config/stadium-locations";

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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerRefs = useRef(new Map<string, import("leaflet").Marker>());
  const selected = STADIUM_LOCATIONS.find((location) => location.club === selectedClub) ?? STADIUM_LOCATIONS[0];
  const fixtures = useMemo(() => venueFixtures(selected.stadium), [selected.stadium]);

  useEffect(() => {
    let active = true;
    const markers = new Map<string, import("leaflet").Marker>();
    async function createMap() {
      if (!mapContainerRef.current || mapRef.current) return;
      const Leaflet = await import("leaflet");
      if (!active || !mapContainerRef.current) return;
      leafletRef.current = Leaflet;
      const map = Leaflet.map(mapContainerRef.current, {
        center: [53.25, -1.35],
        zoom: 6,
        minZoom: 5,
        maxZoom: 17,
        zoomControl: false,
        scrollWheelZoom: false,
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
        marker.on("click", () => setSelectedClub(location.club));
        markers.set(location.club, marker);
      }
      map.fitBounds(bounds, { padding: [38, 38] });
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);
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

  const chooseStadium = (location: StadiumLocation) => {
    setSelectedClub(location.club);
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
          <div className="map-key" aria-hidden="true"><span><i className="home" /> Old Trafford</span><span><i /> สนามเยือน</span></div>
          <span className="map-watermark">GOG<br /><small>ROAD TO GLORY</small></span>
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
