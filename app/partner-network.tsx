"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Car, ChefHat, Camera, Compass, Home, Send, UserPlus } from "lucide-react";
import { PARTNER_KIND_LABEL, PRICING_LABEL, fromPrice } from "@/services/partners";
import type { Partner, PartnerKind } from "@/lib/server/partners";
import { formatThb } from "@/services/pricing";

const KIND_ICON: Record<PartnerKind, typeof Car> = {
  driver: Car,
  photographer: Camera,
  guide: Compass,
  stay: Home,
  restaurant: ChefHat,
};

const KINDS: PartnerKind[] = ["driver", "photographer", "guide", "stay", "restaurant"];
const CITIES = ["Manchester", "London", "Liverpool", "Birmingham", "Newcastle"];

/** สิ่งที่ผู้สมัครแต่ละประเภทต้องเตรียม — ตรงกับ docs/PARTNER-NETWORK.md ข้อ 0 */
const KIND_REQUIREMENTS: Record<PartnerKind, string[]> = {
  driver: [
    "ใบอนุญาตขับขี่รถรับจ้าง (Private Hire Driver Licence) จากสภาท้องถิ่น",
    "ใบอนุญาตตัวรถ (Private Hire Vehicle Licence)",
    "ประกันแบบ hire and reward — ประกันรถส่วนบุคคลใช้ไม่ได้",
    "สิทธิในการทำงานในสหราชอาณาจักร",
  ],
  photographer: ["ประกันความรับผิดต่อบุคคลที่สาม (แนะนำ)", "ตัวอย่างผลงาน", "สิทธิในการทำงานในสหราชอาณาจักร"],
  guide: ["ประวัติการนำเที่ยว", "ใบรับรองไกด์ถ้ามี (เช่น Blue Badge)", "สิทธิในการทำงานในสหราชอาณาจักร"],
  stay: ["หลักฐานสิทธิ์ในการปล่อยเช่า", "ใบตรวจความปลอดภัยอัคคีภัย", "ลอนดอนมีข้อจำกัดปล่อยเช่าระยะสั้น 90 วัน/ปี"],
  restaurant: ["ทะเบียนร้านอาหารกับหน่วยงานท้องถิ่น", "คะแนน Food Hygiene Rating", "ที่อยู่ร้าน"],
};

type Draft = {
  kind: PartnerKind;
  displayName: string;
  legalName: string;
  city: string;
  areas: string;
  languages: string[];
  bio: string;
  email: string;
  phone: string;
  lineId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleSeats: string;
  serviceTitle: string;
  pricingModel: string;
  priceThb: string;
  capacity: string;
  matchdayReady: boolean;
};

const EMPTY_DRAFT: Draft = {
  kind: "driver",
  displayName: "",
  legalName: "",
  city: "Manchester",
  areas: "",
  languages: ["th", "en"],
  bio: "",
  email: "",
  phone: "",
  lineId: "",
  vehicleMake: "Mercedes-Benz",
  vehicleModel: "V-Class",
  vehicleYear: "2022",
  vehicleSeats: "7",
  serviceTitle: "",
  pricingModel: "per_day",
  priceThb: "",
  capacity: "6",
  matchdayReady: true,
};

function PartnerCard({ partner }: { partner: Partner }) {
  const Icon = KIND_ICON[partner.kind];
  const price = fromPrice(partner);
  return (
    <article className="partner-card">
      <header>
        <span className="partner-kind"><Icon size={13} aria-hidden="true" /> {PARTNER_KIND_LABEL[partner.kind]}</span>
        <span className="partner-verified"><BadgeCheck size={12} aria-hidden="true" /> ตรวจแล้ว</span>
      </header>
      <h4>{partner.displayName}</h4>
      <p className="partner-where">
        {partner.city}
        {partner.areas.length > 0 ? ` · ${partner.areas.slice(0, 3).join(" / ")}` : ""}
      </p>
      {partner.vehicle && (
        <p className="partner-vehicle">
          {partner.vehicle.make} {partner.vehicle.model} {partner.vehicle.year} · {partner.vehicle.seats} ที่นั่ง
        </p>
      )}
      {partner.bio && <p className="partner-bio">{partner.bio}</p>}
      {partner.services.length > 0 && (
        <ul className="partner-services">
          {partner.services.slice(0, 3).map((service) => (
            <li key={service.id}>
              <span>{service.title}</span>
              <b>{service.priceThb > 0 ? `${formatThb(service.priceThb)} ${PRICING_LABEL[service.pricingModel] ?? ""}` : "สอบถาม"}</b>
            </li>
          ))}
        </ul>
      )}
      <footer>
        {price > 0 && <span className="partner-from">เริ่มต้น {formatThb(price)}</span>}
        {partner.reviewCount > 0 && <span className="partner-rating">{partner.rating.toFixed(1)}/5 · {partner.reviewCount} รีวิว</span>}
      </footer>
    </article>
  );
}

export function PartnerNetwork() {
  const [tab, setTab] = useState<"directory" | "join">("directory");
  const [cityFilter, setCityFilter] = useState("Manchester");
  const [kindFilter, setKindFilter] = useState<PartnerKind | "all">("all");
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const [error, setError] = useState("");

  const loadPartners = useCallback(async () => {
    const params = new URLSearchParams({ city: cityFilter });
    if (kindFilter !== "all") params.set("kind", kindFilter);
    try {
      const response = await fetch(`/api/partners?${params}`, { cache: "no-store" });
      const payload = await response.json() as { partners?: Partner[] };
      setPartners(payload.partners ?? []);
    } catch {
      setPartners([]);
    }
  }, [cityFilter, kindFilter]);

  useEffect(() => { window.queueMicrotask(loadPartners); }, [loadPartners]);

  const requirements = useMemo(() => KIND_REQUIREMENTS[draft.kind], [draft.kind]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body = {
        kind: draft.kind,
        displayName: draft.displayName,
        legalName: draft.legalName,
        city: draft.city,
        areas: draft.areas.split(",").map((area) => area.trim()).filter(Boolean),
        languages: draft.languages,
        bio: draft.bio,
        email: draft.email,
        phone: draft.phone,
        lineId: draft.lineId,
        vehicle: draft.kind === "driver" ? {
          make: draft.vehicleMake,
          model: draft.vehicleModel,
          year: Number(draft.vehicleYear),
          seats: Number(draft.vehicleSeats),
          luggage: 0,
        } : undefined,
        services: draft.serviceTitle ? [{
          title: draft.serviceTitle,
          pricingModel: draft.pricingModel,
          priceThb: Number(draft.priceThb) || 0,
          capacity: Number(draft.capacity) || 1,
          matchdayReady: draft.matchdayReady,
          notes: "",
        }] : [],
      };
      const response = await fetch("/api/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { ok?: boolean; id?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "สมัครไม่สำเร็จ");
      setSubmitted(payload.id ?? "");
      setDraft(EMPTY_DRAFT);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "สมัครไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="partner-view" aria-labelledby="partner-heading">
      <div className="partner-hero">
        <div>
          <span className="eyebrow">GOG PARTNER NETWORK</span>
          <h2 id="partner-heading">เครือข่ายคนไทยในอังกฤษ</h2>
          <p>
            คนขับรถ · ตากล้อง · ไกด์ท้องถิ่น · ที่พัก · ร้านอาหารไทย — คนไทยที่อยู่อังกฤษลงทะเบียนไว้
            แล้วระบบจับคู่กับแฟนบอลไทยที่บินไปดูพรีเมียร์ลีก
          </p>
        </div>
        <div className="partner-tabs">
          <button type="button" className={tab === "directory" ? "active" : ""} onClick={() => setTab("directory")}>
            หาผู้ให้บริการ
          </button>
          <button type="button" className={tab === "join" ? "active" : ""} onClick={() => setTab("join")}>
            <UserPlus size={13} aria-hidden="true" /> ลงทะเบียนกับ GOG
          </button>
        </div>
      </div>

      {tab === "directory" ? (
        <div className="trip-block">
          <header className="trip-block-head">
            <div>
              <span className="eyebrow">DIRECTORY</span>
              <h3>ผู้ให้บริการที่ผ่านการตรวจแล้ว</h3>
            </div>
            <div className="trip-filters">
              {CITIES.slice(0, 2).map((city) => (
                <button key={city} type="button" className={cityFilter === city ? "active" : ""} onClick={() => setCityFilter(city)}>
                  {city === "Manchester" ? "แมนเชสเตอร์" : "ลอนดอน"}
                </button>
              ))}
              <button type="button" className={kindFilter === "all" ? "active" : ""} onClick={() => setKindFilter("all")}>ทุกประเภท</button>
              {KINDS.map((kind) => (
                <button key={kind} type="button" className={kindFilter === kind ? "active" : ""} onClick={() => setKindFilter(kind)}>
                  {PARTNER_KIND_LABEL[kind]}
                </button>
              ))}
            </div>
          </header>

          {partners === null ? (
            <p className="partner-empty">กำลังโหลด…</p>
          ) : partners.length === 0 ? (
            <div className="partner-empty-state">
              <p>ยังไม่มีผู้ให้บริการที่ผ่านการตรวจในเมืองนี้</p>
              <p className="partner-empty-sub">
                ถ้าคุณอยู่อังกฤษและอยากรับงานกับ GOG กด &quot;ลงทะเบียนกับ GOG&quot; ด้านบนได้เลย
              </p>
            </div>
          ) : (
            <div className="partner-grid">
              {partners.map((partner) => <PartnerCard key={partner.id} partner={partner} />)}
            </div>
          )}

          <p className="trip-disclaimer">
            GOG ทำหน้าที่เป็นไดเรกทอรี — แสดงรายชื่อผู้ให้บริการที่ตรวจเอกสารแล้ว
            ผู้เดินทางตกลงเงื่อนไขและชำระเงินกับผู้ให้บริการโดยตรง GOG ไม่ได้เป็นคู่สัญญาในการให้บริการ
          </p>
        </div>
      ) : (
        <div className="trip-block">
          <header className="trip-block-head">
            <div>
              <span className="eyebrow">JOIN THE NETWORK</span>
              <h3>ลงทะเบียนเป็นผู้ให้บริการ</h3>
            </div>
          </header>

          {submitted ? (
            <div className="partner-submitted">
              <BadgeCheck size={20} aria-hidden="true" />
              <div>
                <strong>รับใบสมัครแล้ว</strong>
                <p>รหัสอ้างอิงของคุณคือ <code>{submitted}</code> — ทีมงานจะติดต่อกลับเพื่อขอเอกสารยืนยัน
                  โปรไฟล์จะขึ้นในไดเรกทอรีหลังตรวจเอกสารเรียบร้อย</p>
                <button type="button" className="story-action ghost" onClick={() => setSubmitted("")}>สมัครเพิ่มอีกรายการ</button>
              </div>
            </div>
          ) : (
            <form className="partner-form" onSubmit={submit}>
              <div className="trip-field trip-field-wide">
                <span>ประเภทบริการ</span>
                <div className="trip-segment">
                  {KINDS.map((kind) => (
                    <button key={kind} type="button" className={draft.kind === kind ? "active" : ""} onClick={() => set("kind", kind)}>
                      {PARTNER_KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="partner-requirements">
                <strong>สิ่งที่ต้องเตรียมสำหรับ{PARTNER_KIND_LABEL[draft.kind]}</strong>
                <ul>{requirements.map((item) => <li key={item}>{item}</li>)}</ul>
                {draft.kind === "driver" && (
                  <p className="partner-legal">
                    การรับส่งผู้โดยสารโดยได้ค่าตอบแทนในอังกฤษต้องมีใบอนุญาตรถรับจ้างทั้งตัวคนขับและตัวรถ
                    และประกันต้องเป็นแบบ hire and reward — เราจะขอเอกสารเหล่านี้ก่อนอนุมัติ
                  </p>
                )}
              </div>

              <label className="trip-field"><span>ชื่อที่ใช้แสดง</span>
                <input required value={draft.displayName} onChange={(event) => set("displayName", event.target.value)} placeholder="เช่น พี่ตุ๊ก แมนเชสเตอร์" /></label>
              <label className="trip-field"><span>ชื่อ-นามสกุลตามเอกสาร</span>
                <input value={draft.legalName} onChange={(event) => set("legalName", event.target.value)} /></label>
              <label className="trip-field"><span>เมืองที่ประจำอยู่</span>
                <select value={draft.city} onChange={(event) => set("city", event.target.value)}>
                  {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
                </select></label>
              <label className="trip-field"><span>พื้นที่ที่ไปได้ (คั่นด้วยจุลภาค)</span>
                <input value={draft.areas} onChange={(event) => set("areas", event.target.value)} placeholder="Old Trafford, Manchester Airport, Liverpool" /></label>

              {draft.kind === "driver" && (
                <>
                  <label className="trip-field"><span>ยี่ห้อรถ</span>
                    <input value={draft.vehicleMake} onChange={(event) => set("vehicleMake", event.target.value)} /></label>
                  <label className="trip-field"><span>รุ่น</span>
                    <input value={draft.vehicleModel} onChange={(event) => set("vehicleModel", event.target.value)} /></label>
                  <label className="trip-field"><span>ปี</span>
                    <input type="number" value={draft.vehicleYear} onChange={(event) => set("vehicleYear", event.target.value)} /></label>
                  <label className="trip-field"><span>จำนวนที่นั่ง</span>
                    <input type="number" min={1} max={60} value={draft.vehicleSeats} onChange={(event) => set("vehicleSeats", event.target.value)} /></label>
                </>
              )}

              <label className="trip-field trip-field-wide"><span>บริการที่เสนอ</span>
                <input value={draft.serviceTitle} onChange={(event) => set("serviceTitle", event.target.value)} placeholder="เช่น รับส่งสนามบินแมนเชสเตอร์ → โรงแรมใจกลางเมือง" /></label>
              <label className="trip-field"><span>คิดราคาแบบ</span>
                <select value={draft.pricingModel} onChange={(event) => set("pricingModel", event.target.value)}>
                  {Object.entries(PRICING_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              <label className="trip-field"><span>ราคา (บาท)</span>
                <input type="number" min={0} value={draft.priceThb} onChange={(event) => set("priceThb", event.target.value)} /></label>
              <label className="trip-field"><span>รับได้สูงสุด (คน)</span>
                <input type="number" min={1} max={60} value={draft.capacity} onChange={(event) => set("capacity", event.target.value)} /></label>
              <label className="trip-field partner-checkbox">
                <input type="checkbox" checked={draft.matchdayReady} onChange={(event) => set("matchdayReady", event.target.checked)} />
                <span>รับงานวันแข่งได้ (รู้เส้นทางเลี่ยงรถติดรอบสนาม)</span>
              </label>

              <label className="trip-field"><span>อีเมล</span>
                <input type="email" value={draft.email} onChange={(event) => set("email", event.target.value)} /></label>
              <label className="trip-field"><span>เบอร์โทร</span>
                <input value={draft.phone} onChange={(event) => set("phone", event.target.value)} /></label>
              <label className="trip-field"><span>LINE ID</span>
                <input value={draft.lineId} onChange={(event) => set("lineId", event.target.value)} /></label>

              <label className="trip-field trip-field-wide"><span>แนะนำตัว</span>
                <textarea rows={4} value={draft.bio} onChange={(event) => set("bio", event.target.value)}
                  placeholder="อยู่อังกฤษมากี่ปี เคยดูแลนักท่องเที่ยวไทยแบบไหนบ้าง จุดแข็งของคุณคืออะไร" /></label>

              {error && <p className="ask-gog-error">{error}</p>}

              <div className="trip-field trip-field-wide">
                <button type="submit" className="partner-submit" disabled={submitting}>
                  <Send size={14} aria-hidden="true" /> {submitting ? "กำลังส่ง…" : "ส่งใบสมัคร"}
                </button>
                <p className="trip-disclaimer">
                  ข้อมูลติดต่อของคุณจะไม่แสดงสาธารณะ · จะปล่อยให้ผู้เดินทางเห็นเมื่อคุณตอบรับคำขอจองเท่านั้น
                  · ทุกใบสมัครเข้าสถานะรอตรวจก่อนเสมอ
                </p>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
