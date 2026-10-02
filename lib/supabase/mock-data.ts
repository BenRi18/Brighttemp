/**
 * Sample data for preview mode (MOCK_DATA=true). Mirrors
 * supabase/seed/demo_seed.sql so both previews show the same world.
 * Dates are recalculated from today on every request.
 */

export type MockRole =
  | "practice"
  | "locum"
  | "admin"
  | "pendingPractice"
  | "pendingLocum"
  | "visitor";

export const MOCK_ROLES: MockRole[] = [
  "practice",
  "locum",
  "admin",
  "pendingPractice",
  "pendingLocum",
  "visitor",
];

type Row = Record<string, unknown>;

// Stable ids so detail-page links keep working between requests.
export const ID = {
  pPractice: "00000000-0000-4000-8000-000000000001",
  pLocum: "00000000-0000-4000-8000-000000000002",
  pLocum2: "00000000-0000-4000-8000-000000000003",
  pHyg: "00000000-0000-4000-8000-000000000004",
  pAdmin: "00000000-0000-4000-8000-000000000005",
  pPendPrac: "00000000-0000-4000-8000-000000000006",
  pPendLocum: "00000000-0000-4000-8000-000000000007",

  prMain: "00000000-0000-4000-8000-000000000101",
  prPending: "00000000-0000-4000-8000-000000000102",

  lMain: "00000000-0000-4000-8000-000000000201",
  lSecond: "00000000-0000-4000-8000-000000000202",
  lHyg: "00000000-0000-4000-8000-000000000203",
  lPending: "00000000-0000-4000-8000-000000000204",

  rNurse: "00000000-0000-4000-8000-000000000301",
  rHyg: "00000000-0000-4000-8000-000000000302",
  rOrtho: "00000000-0000-4000-8000-000000000304",
  rRec: "00000000-0000-4000-8000-000000000303",

  bConfirmed: "00000000-0000-4000-8000-000000000401",
  bRequested: "00000000-0000-4000-8000-000000000402",
  bHyg: "00000000-0000-4000-8000-000000000403",
  bPast: "00000000-0000-4000-8000-000000000404",
};

export const ROLE_PROFILE: Record<Exclude<MockRole, "visitor">, { id: string; type: string; email: string }> = {
  practice: { id: ID.pPractice, type: "practice", email: "demo.practice@example.com" },
  locum: { id: ID.pLocum, type: "locum", email: "demo.locum@example.com" },
  admin: { id: ID.pAdmin, type: "admin", email: "demo.admin@example.com" },
  pendingPractice: { id: ID.pPendPrac, type: "practice", email: "demo.pending-practice@example.com" },
  pendingLocum: { id: ID.pPendLocum, type: "locum", email: "demo.pending-locum@example.com" },
};

// ---------------------------------------------------------------- dates
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(n: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function weekdayFrom(n: number, step: 1 | -1 = 1) {
  const d = addDays(n);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + step);
  return iso(d);
}
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- build
export function buildMockData() {
  const today = iso(addDays(0));
  const dNext = weekdayFrom(7);
  const dLater = weekdayFrom(11);
  const dPast = weekdayFrom(-7, -1);

  const roles: Row[] = [
    { id: ID.rNurse, slug: "dental_nurse", name: "Dental Nurse", requires_gdc: true, is_active: true, sort_order: 1 },
    { id: ID.rHyg, slug: "hygienist", name: "Dental Hygienist", requires_gdc: true, is_active: true, sort_order: 2 },
    { id: ID.rOrtho, slug: "ortho_therapist", name: "Orthodontic Therapist", requires_gdc: true, is_active: true, sort_order: 3 },
    { id: ID.rRec, slug: "receptionist", name: "Receptionist", requires_gdc: false, is_active: true, sort_order: 4 },
  ];
  const roleName = (id: string) => ({ name: roles.find((r) => r.id === id)!.name });

  const profiles: Row[] = [
    [ID.pPractice, "practice", "Sam Patel", "demo.practice@example.com", "07700 900111"],
    [ID.pLocum, "locum", "Amara Okafor", "demo.locum@example.com", "07700 900222"],
    [ID.pLocum2, "locum", "Jade Harrison", "demo.locum2@example.com", "07700 900333"],
    [ID.pHyg, "locum", "Rowan Mitchell", "demo.hygienist@example.com", "07700 900444"],
    [ID.pAdmin, "admin", "Brighttemp Admin", "demo.admin@example.com", null],
    [ID.pPendPrac, "practice", "Dana Walsh", "demo.pending-practice@example.com", null],
    [ID.pPendLocum, "locum", "Chris Bell", "demo.pending-locum@example.com", null],
  ].map(([id, user_type, full_name, email, phone]) => ({
    id, user_type, full_name, email, phone,
    whatsapp_opt_in: false, last_seen_at: null, created_at: now(), updated_at: now(),
  }));
  const person = (id: string) => {
    const p = profiles.find((x) => x.id === id)!;
    return { id: p.id, full_name: p.full_name, email: p.email, phone: p.phone };
  };

  const practiceBase = {
    trading_name: null, address_line2: null, cqc_provider_id: null, billing_address: null,
    vat_number: null, payment_terms_days: 14, purchase_order_required: false,
    suspended_at: null, suspension_reason: null, created_at: now(), updated_at: now(),
  };
  const practices: Row[] = [
    {
      ...practiceBase, id: ID.prMain, name: "Bright Smile Dental", address_line1: "14 Park Row",
      city: "Leeds", postcode: "LS1 5HD", latitude: 53.798, longitude: -1.546,
      phone: "0113 496 0000", email: "reception@brightsmile.example",
      billing_email: "accounts@brightsmile.example", status: "approved", trust_level: "trusted",
      approved_at: now(), approved_by: ID.pAdmin,
    },
    {
      ...practiceBase, id: ID.prPending, name: "Northside Dental", address_line1: "3 Manor Row",
      city: "Bradford", postcode: "BD1 4PB", latitude: 53.796, longitude: -1.754,
      phone: null, email: "hello@northside.example", billing_email: null,
      status: "pending", trust_level: "new", approved_at: null, approved_by: null,
    },
  ];
  const practiceLite = (id: string) => {
    const p = practices.find((x) => x.id === id)!;
    return { id: p.id, name: p.name, city: p.city, postcode: p.postcode, email: p.email, billing_email: p.billing_email };
  };

  const practice_users: Row[] = [
    { id: "pu-1", practice_id: ID.prMain, profile_id: ID.pPractice, role: "owner", is_primary: true },
    { id: "pu-2", practice_id: ID.prPending, profile_id: ID.pPendPrac, role: "owner", is_primary: true },
  ].map((pu) => ({
    ...pu,
    practices: practices.find((p) => p.id === pu.practice_id),
    profiles: person(pu.profile_id),
  }));

  const locumBase = {
    gdc_expiry: null, specialisms: [], suspended_at: null, suspension_reason: null,
    created_at: now(), updated_at: now(), approved_at: now(), approved_by: ID.pAdmin,
  };
  const locums: Row[] = [
    {
      ...locumBase, id: ID.lMain, profile_id: ID.pLocum, role_id: ID.rNurse, gdc_number: "245871",
      years_experience: 9, base_postcode: "LS6 2AA", latitude: 53.82, longitude: -1.57,
      travel_radius_miles: 25, status: "approved", is_bookable: true,
      bio: "Nine years across NHS and private practice. Comfortable with implants and sedation lists.",
    },
    {
      ...locumBase, id: ID.lSecond, profile_id: ID.pLocum2, role_id: ID.rNurse, gdc_number: "251190",
      years_experience: 6, base_postcode: "LS11 5BZ", latitude: 53.78, longitude: -1.55,
      travel_radius_miles: 15, status: "approved", is_bookable: true,
      bio: "Orthodontic and general practice experience.",
    },
    {
      ...locumBase, id: ID.lHyg, profile_id: ID.pHyg, role_id: ID.rHyg, gdc_number: "187342",
      years_experience: 12, base_postcode: "LS8 1AA", latitude: 53.815, longitude: -1.52,
      travel_radius_miles: 30, status: "approved", is_bookable: true,
      bio: "Hygienist and therapist. Periodontal maintenance and direct access.",
    },
    {
      ...locumBase, id: ID.lPending, profile_id: ID.pPendLocum, role_id: ID.rRec, gdc_number: null,
      years_experience: 3, base_postcode: "LS2 7EW", latitude: 53.801, longitude: -1.548,
      travel_radius_miles: 10, status: "pending", is_bookable: false, bio: null,
      approved_at: null, approved_by: null,
    },
  ].map((l) => ({
    ...l,
    profiles: person(l.profile_id as string),
    roles: roleName(l.role_id as string),
    created_at: l.status === "pending" ? iso(addDays(-2)) : now(),
  }));
  const locumLite = (id: string) => {
    const l = locums.find((x) => x.id === id)!;
    return {
      id: l.id, years_experience: l.years_experience, is_bookable: l.is_bookable,
      base_postcode: l.base_postcode, profiles: l.profiles, roles: l.roles,
    };
  };

  const DOCS = ["gdc_registration", "photo_id", "dbs", "indemnity_insurance", "hepatitis_b", "cpr_certificate", "infection_control"];
  const EXPIRES = new Set(["gdc_registration", "indemnity_insurance", "cpr_certificate", "infection_control"]);

  const compliance_requirements: Row[] = [];
  for (const r of [ID.rNurse, ID.rHyg, ID.rOrtho]) {
    for (const d of DOCS) {
      compliance_requirements.push({
        id: `${r}-${d}`, role_id: r, doc_type: d, is_mandatory: true,
        requires_expiry: EXPIRES.has(d), expiry_warning_days: 30,
      });
    }
  }
  for (const d of ["photo_id", "dbs", "infection_control"]) {
    compliance_requirements.push({
      id: `${ID.rRec}-${d}`, role_id: ID.rRec, doc_type: d, is_mandatory: true,
      requires_expiry: EXPIRES.has(d), expiry_warning_days: 30,
    });
  }

  const compliance_documents: Row[] = [];
  let n = 0;
  for (const l of [ID.lMain, ID.lSecond, ID.lHyg]) {
    const role = locums.find((x) => x.id === l)!.role_id;
    for (const req of compliance_requirements.filter((r) => r.role_id === role)) {
      compliance_documents.push({
        id: `doc-${++n}`, locum_id: l, doc_type: req.doc_type,
        storage_path: `${l}/${req.doc_type}/demo.pdf`, original_filename: "demo.pdf",
        mime_type: "application/pdf", size_bytes: 120000,
        issue_date: iso(addDays(-200)),
        expiry_date: req.requires_expiry ? iso(addDays(300)) : null,
        reference: null, status: "approved", is_current: true,
        uploaded_at: iso(addDays(-200)), reviewed_at: now(), reviewed_by: ID.pAdmin,
        rejection_reason: null, updated_at: now(),
      });
    }
  }
  const expiring = compliance_documents.find((d) => d.locum_id === ID.lSecond && d.doc_type === "cpr_certificate")!;
  expiring.expiry_date = iso(addDays(18));
  expiring.status = "expiring_soon";

  compliance_documents.push(
    {
      id: `doc-${++n}`, locum_id: ID.lPending, doc_type: "dbs", storage_path: `${ID.lPending}/dbs/demo.pdf`,
      original_filename: "dbs-certificate.pdf", mime_type: "application/pdf", size_bytes: 98000,
      issue_date: iso(addDays(-40)), expiry_date: null, reference: "001234567890",
      status: "pending", is_current: true, uploaded_at: iso(addDays(-1)), reviewed_at: null,
      reviewed_by: null, rejection_reason: null, updated_at: now(),
    },
    {
      id: `doc-${++n}`, locum_id: ID.lPending, doc_type: "infection_control",
      storage_path: `${ID.lPending}/infection_control/demo.pdf`, original_filename: "ipc-training.pdf",
      mime_type: "application/pdf", size_bytes: 76000, issue_date: iso(addDays(-10)),
      expiry_date: iso(addDays(355)), reference: null, status: "rejected", is_current: true,
      uploaded_at: iso(addDays(-1)), reviewed_at: now(), reviewed_by: ID.pAdmin,
      rejection_reason: "The certificate is cut off at the bottom — please upload the full page.",
      updated_at: now(),
    },
  );
  for (const d of compliance_documents) {
    const l = locums.find((x) => x.id === d.locum_id)!;
    d.locums = { id: l.id, profiles: l.profiles, roles: l.roles };
  }

  const rate = (locum: string, day: string, amount: number, status = "approved", i = 0): Row => ({
    id: `rate-${locum.slice(-3)}-${day}-${status}-${i}`, locum_id: locum, day_type: day,
    hourly_rate: amount, status, effective_from: iso(addDays(-60)), effective_to: null,
    requested_at: status === "pending" ? iso(addDays(-1)) : iso(addDays(-60)),
    reviewed_at: status === "pending" ? null : now(), reviewed_by: null, review_note: null,
    locums: { id: locum, profiles: locums.find((x) => x.id === locum)!.profiles },
  });
  const locum_rates: Row[] = [
    rate(ID.lMain, "weekday", 17.5), rate(ID.lMain, "weekend", 21), rate(ID.lMain, "bank_holiday", 26),
    rate(ID.lSecond, "weekday", 18), rate(ID.lSecond, "weekend", 22), rate(ID.lSecond, "bank_holiday", 27),
    rate(ID.lHyg, "weekday", 36.5), rate(ID.lHyg, "weekend", 42), rate(ID.lHyg, "bank_holiday", 48),
    rate(ID.lMain, "weekday", 18.5, "pending", 1),
  ];

  const locum_availability: Row[] = [];
  for (const l of [ID.lMain, ID.lSecond, ID.lHyg]) {
    for (let i = 0; i <= 45; i++) {
      const d = addDays(i);
      if ([0, 6].includes(d.getUTCDay())) continue;
      locum_availability.push({
        id: `av-${l.slice(-3)}-${i}`, locum_id: l, available_on: iso(d), is_available: true,
        start_time: "08:00:00", finish_time: "18:00:00", note: null,
      });
    }
  }

  const booking = (
    id: string, reference: string, locum: string, role: string, date: string,
    start: string, finish: string, rateAmt: number, fee: number, status: string, notes: string | null = null,
  ): Row => {
    const [sh, sm] = start.split(":").map(Number);
    const [fh, fm] = finish.split(":").map(Number);
    const hours = (fh * 60 + fm - (sh * 60 + sm)) / 60;
    return {
      id, reference, practice_id: ID.prMain, locum_id: locum, role_id: role,
      booking_date: date, start_time: `${start}:00`, finish_time: `${finish}:00`,
      hours, locum_hourly_rate: rateAmt, locum_total: Math.round(rateAmt * hours * 100) / 100,
      fee_day_type: "weekday", booking_fee: fee, same_day_surcharge: 0, is_same_day: false,
      status, requires_admin_approval: false, notes, created_by: ID.pPractice,
      requested_at: iso(addDays(-3)), accepted_at: null,
      confirmed_at: ["confirmed", "completed"].includes(status) ? iso(addDays(-2)) : null,
      completed_at: status === "completed" ? dPast : null, created_at: now(), updated_at: now(),
      roles: roleName(role), practices: practiceLite(ID.prMain), locums: locumLite(locum),
    };
  };
  const bookings: Row[] = [
    booking(ID.bConfirmed, "BT-2026-000101", ID.lMain, ID.rNurse, dNext, "09:00", "17:00", 17.5, 30, "confirmed",
      "Implant list in surgery 2 in the morning. Parking at the rear."),
    booking(ID.bRequested, "BT-2026-000102", ID.lMain, ID.rNurse, dLater, "08:30", "13:00", 17.5, 30, "requested"),
    booking(ID.bHyg, "BT-2026-000103", ID.lHyg, ID.rHyg, dNext, "13:00", "17:30", 36.5, 40, "requested"),
    booking(ID.bPast, "BT-2026-000094", ID.lMain, ID.rNurse, dPast, "09:00", "17:00", 17.5, 30, "completed"),
  ];

  const history = (b: string, steps: string[]): Row[] =>
    steps.map((to, i) => ({
      id: `h-${b.slice(-3)}-${i}`, booking_id: b, from_status: i === 0 ? null : steps[i - 1],
      to_status: to, changed_by: null, actor: "system", reason: null,
      changed_at: new Date(Date.now() - (steps.length - i) * 36e5 * 20).toISOString(),
    }));
  const booking_status_history: Row[] = [
    ...history(ID.bConfirmed, ["requested", "accepted", "confirmed"]),
    ...history(ID.bRequested, ["requested"]),
    ...history(ID.bHyg, ["requested"]),
    ...history(ID.bPast, ["requested", "accepted", "confirmed", "completed"]),
  ];

  const invoice = (id: string, num: string, b: string, issue: string, status: string): Row => {
    const bk = bookings.find((x) => x.id === b)!;
    return {
      id, invoice_number: num, practice_id: ID.prMain, booking_id: b,
      issue_date: issue, due_date: iso(new Date(new Date(`${issue}T00:00:00Z`).getTime() + 14 * 864e5)),
      subtotal: 30, vat_rate: 0.2, vat_amount: 6, total: 36, status,
      sent_at: status === "draft" ? null : issue, paid_at: status === "paid" ? now() : null,
      notes: null, created_at: now(), updated_at: now(),
      practices: { name: "Bright Smile Dental" },
      bookings: { reference: bk.reference, booking_date: bk.booking_date },
    };
  };
  const invoices: Row[] = [
    invoice("inv-2", "INV-2026-000058", ID.bConfirmed, iso(addDays(-2)), "sent"),
    invoice("inv-1", "INV-2026-000051", ID.bPast, dPast, "paid"),
  ];

  const favourite_locums: Row[] = [ID.lMain, ID.lHyg].map((l, i) => ({
    practice_id: ID.prMain, locum_id: l, created_by: ID.pPractice,
    created_at: iso(addDays(-10 - i)), locums: locumLite(l),
  }));

  const FEES: [string, string, number][] = [
    [ID.rNurse, "weekday", 30], [ID.rNurse, "weekend", 35], [ID.rNurse, "bank_holiday", 45],
    [ID.rHyg, "weekday", 40], [ID.rHyg, "weekend", 45], [ID.rHyg, "bank_holiday", 50],
    [ID.rOrtho, "weekday", 40], [ID.rOrtho, "weekend", 45], [ID.rOrtho, "bank_holiday", 50],
    [ID.rRec, "weekday", 30], [ID.rRec, "weekend", 35], [ID.rRec, "bank_holiday", 40],
  ];
  const fees: Row[] = [
    ...FEES.map(([role_id, day_type, amount], i) => ({
      id: `fee-${i}`, fee_type: "booking", role_id, day_type, amount,
      notice_hours_below: null, effective_from: iso(addDays(-90)), effective_to: null,
      roles: { id: role_id, ...roleName(role_id), sort_order: roles.find((r) => r.id === role_id)!.sort_order },
    })),
    { id: "fee-sd", fee_type: "same_day_surcharge", role_id: null, day_type: null, amount: 10,
      notice_hours_below: null, effective_from: iso(addDays(-90)), effective_to: null, roles: null },
    { id: "fee-cx", fee_type: "cancellation", role_id: null, day_type: null, amount: 30,
      notice_hours_below: 24, effective_from: iso(addDays(-90)), effective_to: null, roles: null },
  ];

  const admin_users: Row[] = [
    { profile_id: ID.pAdmin, admin_role: "super_admin", permissions: {}, is_active: true, created_at: now() },
  ];

  return {
    today,
    tables: {
      roles, profiles, practices, practice_users, locums, compliance_requirements,
      compliance_documents, locum_rates, locum_availability, bookings,
      booking_status_history, invoices, payments: [] as Row[], favourite_locums, fees,
      admin_users, notifications: [] as Row[], platform_settings: [] as Row[],
    } as Record<string, Row[]>,
  };
}
