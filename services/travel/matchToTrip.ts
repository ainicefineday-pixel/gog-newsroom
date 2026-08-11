// สะพานจากแมตช์ไปสู่ทริป (STEP 61, 62, 63, 64, 65)
// ---------------------------------------------------------------------------
// ตรรกะเลือกสนามบินและประมาณราคาอยู่ที่นี่ ไม่ใช่ในคอมโพเนนต์หน้าเว็บ (STEP 62)
// ราคาทุกตัวเป็น "ประมาณการเพื่อวางแผน" — ยังไม่ได้ต่อระบบจองจริง
// ห้ามเขียนคำว่าราคาสด ห้ามบอกว่าเหลือกี่ที่นั่ง (STEP 64)

import { ARRIVAL_AIRPORTS, BANGKOK, listFlights } from "@/services/flights";
import { defaultHotel } from "@/services/hotels";
import { estimateTrip, railDayTripThb } from "@/services/pricing";
import { getStadiumTravelPlan, totalTravelMinutes } from "@/config/stadium-travel";
import type { BudgetStyle, DestinationCity, TripLength } from "@/services/trip/types";
import type { GOGFixture } from "@/services/football/types";

/** เมืองที่บินลงตรงได้ — ที่เหลือใช้เมืองฐานแล้วต่อรถไฟในวันแข่ง */
const LONDON_CITIES = new Set(["London"]);

export type MatchTravelPlan = {
  /** คีย์ของแมตช์ในเครื่องมือวางแผนทริป — ใช้เลือกแมตช์ให้อัตโนมัติตอนสลับแท็บ */
  tripFixtureKey: string;
  originAirport: string;
  originCity: string;
  /** เมืองฐานที่พักตลอดทริป */
  baseCity: DestinationCity;
  baseCityTh: string;
  recommendedAirports: string[];
  /** สนามอยู่คนละเมืองกับที่พักหรือไม่ */
  railDay: boolean;
  venueCity: string;
  railMinutes: number | null;
  railRoute: string | null;
  /** ตารางราคาโดยประมาณ 3 ความยาวทริป × 3 ระดับงบ */
  estimates: Array<{ length: TripLength; prices: Array<{ budget: BudgetStyle; perPerson: number }> }>;
};

function baseCityFor(venueCity: string): DestinationCity {
  return LONDON_CITIES.has(venueCity) ? "London" : "Manchester";
}

/**
 * คีย์แมตช์ในเครื่องมือวางแผนทริป = "เลขนัด-วันเตะ"
 * ตรงกับ fixtureKey() ใน services/football/fixtures.ts เพื่อให้ส่งต่อกันได้ตรง ๆ
 */
export function tripFixtureKeyOf(fixture: GOGFixture) {
  return `${fixture.matchweek ?? 0}-${fixture.kickoffUtc.slice(0, 10)}`;
}

/**
 * ประกอบข้อมูลที่ต้องส่งเข้าเครื่องมือวางแผนทริปจากแมตช์หนึ่งนัด (STEP 61)
 * รวมถึงตารางราคาโดยประมาณสำหรับการ์ดพรีวิวในหน้าแมตช์ (STEP 63)
 */
export function buildMatchTravelPlan(fixture: GOGFixture): MatchTravelPlan {
  const venueCity = fixture.venue?.city || (fixture.home.name === "Manchester United" ? "Manchester" : "");
  const baseCity = baseCityFor(venueCity);
  const airports = ARRIVAL_AIRPORTS.filter((airport) => airport.city === baseCity);
  const railPlan = venueCity && venueCity !== baseCity && fixture.venue
    ? getStadiumTravelPlan(fixture.venue.name)
    : null;

  const lengths: TripLength[] = [5, 8, 10];
  const budgets: BudgetStyle[] = ["saver", "comfort", "premium"];

  const estimates = lengths.map((length) => ({
    length,
    prices: budgets.map((budget) => {
      const flight = listFlights(airports.map((airport) => airport.code), budget, "best")[0];
      const hotel = defaultHotel(baseCity, budget);
      const railLine = railPlan
        ? [{ key: "railday", label: "รถไฟวันแข่ง", amount: railDayTripThb(railPlan.distanceKm, budget) }]
        : [];
      return {
        budget,
        perPerson: estimateTrip({
          length,
          nights: length - 1,
          city: baseCity,
          budget,
          // การ์ดพรีวิวคิดที่ 2 คนต่อห้อง ซึ่งเป็นกรณีที่คนไทยไปกันบ่อยที่สุด
          travellers: 2,
          flightFare: flight?.estimatedFare[budget] ?? 0,
          hotelNightly: hotel?.nightlyThb ?? 0,
          includeMatch: true,
          extraLines: railLine,
        }).perPerson,
      };
    }),
  }));

  return {
    tripFixtureKey: tripFixtureKeyOf(fixture),
    originAirport: BANGKOK.code,
    originCity: BANGKOK.city,
    baseCity,
    baseCityTh: baseCity === "Manchester" ? "แมนเชสเตอร์" : "ลอนดอน",
    recommendedAirports: airports.map((airport) => airport.code),
    railDay: Boolean(railPlan),
    venueCity,
    railMinutes: railPlan ? totalTravelMinutes(railPlan) : null,
    railRoute: railPlan ? `${railPlan.origin} → ${railPlan.destination}` : null,
    estimates,
  };
}
