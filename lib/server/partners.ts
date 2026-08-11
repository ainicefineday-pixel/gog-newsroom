// GOG Partner Network — ชั้นที่แตะฐานข้อมูล (ดู docs/PARTNER-NETWORK.md)
// ---------------------------------------------------------------------------
// โหมดที่เปิดใช้ตอนนี้คือ "ไดเรกทอรี" (ทางเลือก A ในเอกสาร):
// GOG แสดงรายชื่อผู้ให้บริการที่ตรวจแล้ว ผู้เดินทางติดต่อและจ่ายเงินกันเอง
// GOG ยังไม่รับเงินค่าบริการ จึงยังไม่เข้าข่ายเป็น private hire operator
//
// ทุกคนที่สมัครเข้าสถานะ pending เสมอ — หน้าเว็บสาธารณะแสดงเฉพาะ verified



export const PARTNER_KINDS = ["driver", "photographer", "guide", "stay", "restaurant", "massage"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_STATUSES = ["pending", "verified", "suspended", "rejected"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PRICING_MODELS = ["per_day", "per_hour", "per_transfer", "per_person", "per_night"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export type PartnerService = {
  id: string;
  title: string;
  pricingModel: PricingModel;
  priceThb: number;
  capacity: number;
  matchdayReady: boolean;
  notes: string;
};

export type Partner = {
  id: string;
  kind: PartnerKind;
  displayName: string;
  city: string;
  areas: string[];
  languages: string[];
  bio: string;
  status: PartnerStatus;
  rating: number;
  reviewCount: number;
  /** เฉพาะคนขับรถ */
  vehicle: { make: string; model: string; year: number; seats: number; luggage: number } | null;
  services: PartnerService[];
  createdAt: string;
  /** ช่องทางติดต่อ — ไม่ส่งออก API สาธารณะ ปล่อยเมื่อจับคู่สำเร็จเท่านั้น */
  contact?: { email: string; phone: string; lineId: string };
};

type PartnerRow = {
  id: string;
  kind: PartnerKind;
  display_name: string;
  legal_name: string | null;
  city: string;
  areas_json: string;
  languages_json: string;
  bio: string;
  email: string;
  phone: string;
  line_id: string;
  status: PartnerStatus;
  rating: number | null;
  review_count: number | null;
  vehicle_json: string | null;
  services_json: string;
  created_at: string;
  updated_at: string;
};

export async function ensurePartnerTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      display_name TEXT NOT NULL,
      legal_name TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL,
      areas_json TEXT NOT NULL DEFAULT '[]',
      languages_json TEXT NOT NULL DEFAULT '[]',
      bio TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      line_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      rating REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      vehicle_json TEXT,
      services_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS partner_documents (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      r2_key TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS booking_requests (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      service_id TEXT NOT NULL DEFAULT '',
      trip_id TEXT NOT NULL DEFAULT '',
      traveller_name TEXT NOT NULL,
      traveller_contact TEXT NOT NULL,
      service_date TEXT NOT NULL,
      pax INTEGER NOT NULL DEFAULT 1,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'requested',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    // คำขอทั้งทริปหนึ่งชุด (STEP 76)
    // จองทีละเจ้าคือการกรอกชื่อ เบอร์ วันที่ ซ้ำห้ารอบ แล้วยังไม่รู้ว่าใครตอบแล้วบ้าง
    // ตารางนี้เป็นหัวของคำขอชุดหนึ่ง ส่วน booking_requests แต่ละแถวอ้างกลับมาที่ trip_id
    db.prepare(`CREATE TABLE IF NOT EXISTS trip_booking_groups (
      id TEXT PRIMARY KEY,
      traveller_name TEXT NOT NULL,
      traveller_contact TEXT NOT NULL,
      trip_title TEXT NOT NULL DEFAULT '',
      match_label TEXT NOT NULL DEFAULT '',
      depart_date TEXT NOT NULL DEFAULT '',
      return_date TEXT NOT NULL DEFAULT '',
      pax INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_partners_status_city ON partners(status, city)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_partner_documents_partner ON partner_documents(partner_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_booking_requests_partner ON booking_requests(partner_id, created_at)"),
  ]);
}

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function rowToPartner(row: PartnerRow, includeContact = false): Partner {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.display_name,
    city: row.city,
    areas: safeJson(row.areas_json, [] as string[]),
    languages: safeJson(row.languages_json, [] as string[]),
    bio: row.bio,
    status: row.status,
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? 0,
    vehicle: safeJson(row.vehicle_json, null as Partner["vehicle"]),
    services: safeJson(row.services_json, [] as PartnerService[]),
    createdAt: row.created_at,
    ...(includeContact ? { contact: { email: row.email, phone: row.phone, lineId: row.line_id } } : {}),
  };
}

export type PartnerDraft = {
  kind: PartnerKind;
  displayName: string;
  legalName: string;
  city: string;
  areas: string[];
  languages: string[];
  bio: string;
  email: string;
  phone: string;
  lineId: string;
  vehicle: Partner["vehicle"];
  services: PartnerService[];
};

function newId(prefix: string) {
  return prefix + Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

export async function createPartner(db: D1Database, draft: PartnerDraft) {
  await ensurePartnerTables(db);
  const now = new Date().toISOString();
  const id = newId("ptn_");
  await db
    .prepare(`INSERT INTO partners (
      id, kind, display_name, legal_name, city, areas_json, languages_json, bio,
      email, phone, line_id, status, vehicle_json, services_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`)
    .bind(
      id,
      draft.kind,
      draft.displayName,
      draft.legalName,
      draft.city,
      JSON.stringify(draft.areas),
      JSON.stringify(draft.languages),
      draft.bio,
      draft.email,
      draft.phone,
      draft.lineId,
      draft.vehicle ? JSON.stringify(draft.vehicle) : null,
      JSON.stringify(draft.services),
      now,
      now,
    )
    .run();
  return { id, status: "pending" as PartnerStatus, createdAt: now };
}

/** รายชื่อสาธารณะ — เฉพาะ verified และไม่ส่งช่องทางติดต่อออกไป */
export async function listVerifiedPartners(db: D1Database, filters: { city?: string; kind?: PartnerKind } = {}) {
  await ensurePartnerTables(db);
  const conditions = ["status = 'verified'"];
  const bindings: string[] = [];
  if (filters.city) { conditions.push("city = ?"); bindings.push(filters.city); }
  if (filters.kind) { conditions.push("kind = ?"); bindings.push(filters.kind); }
  const result = await db
    .prepare(`SELECT * FROM partners WHERE ${conditions.join(" AND ")} ORDER BY rating DESC, created_at DESC LIMIT 100`)
    .bind(...bindings)
    .all<PartnerRow>();
  return (result.results ?? []).map((row) => rowToPartner(row));
}

/** สำหรับหน้าตรวจสอบของทีมงาน — เห็นทุกสถานะและเห็นช่องทางติดต่อ */
export async function listAllPartners(db: D1Database) {
  await ensurePartnerTables(db);
  const result = await db
    .prepare("SELECT * FROM partners ORDER BY created_at DESC LIMIT 200")
    .all<PartnerRow>();
  return (result.results ?? []).map((row) => rowToPartner(row, true));
}

export async function setPartnerStatus(db: D1Database, id: string, status: PartnerStatus) {
  await ensurePartnerTables(db);
  const now = new Date().toISOString();
  const result = await db
    .prepare("UPDATE partners SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, id)
    .run();
  return { id, status, changed: result.meta?.changes ?? 0 };
}

export async function createBookingRequest(db: D1Database, input: {
  partnerId: string;
  serviceId: string;
  tripId: string;
  travellerName: string;
  travellerContact: string;
  serviceDate: string;
  pax: number;
  message: string;
}) {
  await ensurePartnerTables(db);
  const now = new Date().toISOString();
  const id = newId("bkg_");
  await db
    .prepare(`INSERT INTO booking_requests (
      id, partner_id, service_id, trip_id, traveller_name, traveller_contact,
      service_date, pax, message, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`)
    .bind(id, input.partnerId, input.serviceId, input.tripId, input.travellerName,
      input.travellerContact, input.serviceDate, input.pax, input.message, now, now)
    .run();
  return { id, status: "requested" as const, createdAt: now };
}

export type TripRequestItem = {
  partnerId: string;
  serviceId: string;
  serviceDate: string;
  message: string;
};

export type TripRequestResult = {
  groupId: string;
  createdAt: string;
  sent: Array<{ bookingId: string; partnerId: string; partnerName: string; kind: PartnerKind; serviceDate: string }>;
  /** รายการที่ส่งไม่ได้ พร้อมเหตุผล — ต้องบอกผู้ใช้ ไม่ใช่เงียบไป */
  rejected: Array<{ partnerId: string; reason: "not_found" | "not_verified" | "bad_date" }>;
};

/**
 * ส่งคำขอทั้งทริปในครั้งเดียว (STEP 76)
 *
 * ทุกรายการอ้าง trip_id เดียวกัน เพื่อให้ตามสถานะได้ว่าคำขอชุดนี้ใครตอบแล้วบ้าง
 *
 * ตรวจว่าผู้ให้บริการยัง verified อยู่จริงทุกครั้งก่อนส่ง ไม่เชื่อ id ที่มาจากเบราว์เซอร์
 * เพราะรายชื่อในหน้าเว็บอาจค้างจากตอนโหลด แล้วทีมงานเพิ่งระงับเจ้านั้นไป
 * ส่งคำขอไปให้เจ้าที่ถูกระงับ = ส่งชื่อและเบอร์ผู้ใช้ให้คนที่เราตัดออกจากเครือข่ายแล้ว
 */
export async function createTripRequest(db: D1Database, input: {
  travellerName: string;
  travellerContact: string;
  tripTitle: string;
  matchLabel: string;
  departDate: string;
  returnDate: string;
  pax: number;
  note: string;
  items: TripRequestItem[];
}): Promise<TripRequestResult> {
  await ensurePartnerTables(db);
  const now = new Date().toISOString();
  const groupId = newId("trip_");

  await db.prepare(`INSERT INTO trip_booking_groups (
    id, traveller_name, traveller_contact, trip_title, match_label,
    depart_date, return_date, pax, note, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(groupId, input.travellerName, input.travellerContact, input.tripTitle,
      input.matchLabel, input.departDate, input.returnDate, input.pax, input.note, now)
    .run();

  const sent: TripRequestResult["sent"] = [];
  const rejected: TripRequestResult["rejected"] = [];

  for (const item of input.items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.serviceDate)) {
      rejected.push({ partnerId: item.partnerId, reason: "bad_date" });
      continue;
    }
    const row = await db.prepare("SELECT id, display_name, kind, status FROM partners WHERE id = ?")
      .bind(item.partnerId)
      .first<{ id: string; display_name: string; kind: PartnerKind; status: PartnerStatus }>();
    if (!row) { rejected.push({ partnerId: item.partnerId, reason: "not_found" }); continue; }
    if (row.status !== "verified") { rejected.push({ partnerId: item.partnerId, reason: "not_verified" }); continue; }

    const booking = await createBookingRequest(db, {
      partnerId: item.partnerId,
      serviceId: item.serviceId,
      tripId: groupId,
      travellerName: input.travellerName,
      travellerContact: input.travellerContact,
      serviceDate: item.serviceDate,
      pax: input.pax,
      // ใส่บริบททริปไปกับทุกคำขอ ผู้ให้บริการจะได้รู้ว่าเป็นงานชุดเดียวกัน
      message: [
        input.matchLabel ? `แมตช์: ${input.matchLabel}` : "",
        input.departDate && input.returnDate ? `ช่วงเดินทาง: ${input.departDate} ถึง ${input.returnDate}` : "",
        item.message,
        input.note,
        `รหัสคำขอชุดนี้: ${groupId}`,
      ].filter(Boolean).join("\n"),
    });
    sent.push({
      bookingId: booking.id,
      partnerId: row.id,
      partnerName: row.display_name,
      kind: row.kind,
      serviceDate: item.serviceDate,
    });
  }

  return { groupId, createdAt: now, sent, rejected };
}

/** สถานะคำขอชุดหนึ่ง — ผู้ใช้เอารหัสมาเช็กได้ว่าใครตอบรับแล้วบ้าง */
export async function getTripRequest(db: D1Database, groupId: string) {
  await ensurePartnerTables(db);
  const group = await db.prepare("SELECT * FROM trip_booking_groups WHERE id = ?")
    .bind(groupId)
    .first<{
      id: string; traveller_name: string; trip_title: string; match_label: string;
      depart_date: string; return_date: string; pax: number; note: string; created_at: string;
    }>();
  if (!group) return null;

  const rows = await db.prepare(`SELECT b.id, b.partner_id, b.service_date, b.status, b.created_at,
      p.display_name, p.kind
    FROM booking_requests b LEFT JOIN partners p ON p.id = b.partner_id
    WHERE b.trip_id = ? ORDER BY b.service_date, b.created_at`)
    .bind(groupId)
    .all<{
      id: string; partner_id: string; service_date: string; status: string;
      created_at: string; display_name: string | null; kind: string | null;
    }>();

  return {
    groupId: group.id,
    // ไม่ส่งเบอร์ติดต่อกลับออกไป เพราะ endpoint นี้ไม่ได้ล็อกอิน รู้รหัสก็เปิดดูได้
    travellerName: group.traveller_name,
    tripTitle: group.trip_title,
    matchLabel: group.match_label,
    departDate: group.depart_date,
    returnDate: group.return_date,
    pax: group.pax,
    note: group.note,
    createdAt: group.created_at,
    bookings: (rows.results ?? []).map((row) => ({
      bookingId: row.id,
      partnerId: row.partner_id,
      partnerName: row.display_name ?? "ผู้ให้บริการถูกลบออกจากระบบ",
      kind: row.kind,
      serviceDate: row.service_date,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}
