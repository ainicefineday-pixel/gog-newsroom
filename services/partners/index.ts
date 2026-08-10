// ตรรกะจับคู่พาร์ตเนอร์กับทริป (ดู docs/PARTNER-NETWORK.md ข้อ 3)
// ไม่มี JSX ไม่แตะฐานข้อมูล — รับข้อมูลเข้ามาแล้วให้คะแนน

import type { Partner, PartnerKind } from "@/lib/server/partners";

export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = {
  driver: "คนขับรถ",
  photographer: "ตากล้อง",
  guide: "ไกด์ท้องถิ่น",
  stay: "ที่พัก",
  restaurant: "ร้านอาหารไทย",
};

export const PRICING_LABEL: Record<string, string> = {
  per_day: "ต่อวัน",
  per_hour: "ต่อชั่วโมง",
  per_transfer: "ต่อเที่ยว",
  per_person: "ต่อคน",
  per_night: "ต่อคืน",
};

export type MatchContext = {
  city: string;
  travellers: number;
  /** true = ต้องการคนที่รับงานวันแข่งได้ */
  matchday: boolean;
};

export type ScoredPartner = {
  partner: Partner;
  score: number;
  reasons: string[];
};

// น้ำหนักอยู่ที่เดียว ปรับได้โดยไม่ต้องไล่แก้หลายไฟล์
const WEIGHTS = {
  city: 30,
  capacity: 25,
  rating: 20,
  matchday: 15,
  languages: 10,
};

/**
 * ให้คะแนนและเรียงพาร์ตเนอร์ตามความเหมาะกับทริป
 * ตัวกรองแข็ง: เมืองต้องตรง และต้องรองรับจำนวนคนได้ — ไม่ผ่านคือไม่แสดงเลย
 */
export function rankPartners(partners: Partner[], context: MatchContext): ScoredPartner[] {
  return partners
    .filter((partner) => partner.city === context.city)
    .map((partner) => {
      const reasons: string[] = [];
      let score = WEIGHTS.city;
      reasons.push(`อยู่ใน${context.city}`);

      const capacity = Math.max(
        ...partner.services.map((service) => service.capacity),
        partner.vehicle?.seats ?? 0,
        0,
      );
      if (capacity >= context.travellers) {
        score += WEIGHTS.capacity;
        if (partner.vehicle) reasons.push(`รถ ${partner.vehicle.seats} ที่นั่ง รับ ${context.travellers} คนได้`);
      }

      score += (Math.min(partner.rating, 5) / 5) * WEIGHTS.rating;
      if (partner.reviewCount > 0) reasons.push(`${partner.rating.toFixed(1)}/5 จาก ${partner.reviewCount} รีวิว`);

      const matchdayReady = partner.services.some((service) => service.matchdayReady);
      if (context.matchday && matchdayReady) {
        score += WEIGHTS.matchday;
        reasons.push("รับงานวันแข่งได้");
      }

      if (partner.languages.includes("th")) {
        score += WEIGHTS.languages;
        reasons.push("สื่อสารภาษาไทยได้");
      }

      return { partner, score, reasons };
    })
    // รองรับจำนวนคนไม่ได้ = คะแนนไม่ถึงเกณฑ์ ตัดทิ้ง
    .filter((entry) => entry.score >= WEIGHTS.city + WEIGHTS.capacity * 0.5)
    .sort((a, b) => b.score - a.score);
}

/** ราคาต่ำสุดที่พาร์ตเนอร์รายนี้เสนอ — ใช้แสดงบนการ์ด */
export function fromPrice(partner: Partner) {
  const prices = partner.services.map((service) => service.priceThb).filter((price) => price > 0);
  return prices.length ? Math.min(...prices) : 0;
}
