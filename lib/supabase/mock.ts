/**
 * Preview mode: a stand-in for the Supabase client that answers the app's
 * queries from sample data, so every page can be looked at without a
 * database, an account or a sign-in.
 *
 * On only when MOCK_DATA=true AND this is not a production build. Nothing
 * is saved — every write "succeeds" and changes nothing.
 */
import { buildMockData, ROLE_PROFILE, ID, MOCK_ROLES, type MockRole } from "./mock-data";

export const MOCK_ROLE_COOKIE = "bt_preview_role";

export function mockModeEnabled() {
  return process.env.MOCK_DATA === "true" && process.env.NODE_ENV !== "production";
}

export function parseMockRole(value: string | undefined): MockRole {
  return MOCK_ROLES.includes(value as MockRole) ? (value as MockRole) : "practice";
}

/** The fake auth user for a role, shaped like Supabase's User object. */
export function mockUser(role: MockRole) {
  if (role === "visitor") return null;
  const p = ROLE_PROFILE[role];
  return {
    id: p.id,
    email: p.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", user_type: p.type },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
}

type Row = Record<string, unknown>;
type Result = { data: unknown; error: null; count: number | null };

/** Row visibility, standing in for the RLS policies. */
function visibleRows(table: string, rows: Row[], role: MockRole): Row[] {
  const myPractice = role === "practice" ? ID.prMain : role === "pendingPractice" ? ID.prPending : null;
  const myLocum = role === "locum" ? ID.lMain : role === "pendingLocum" ? ID.lPending : null;
  if (role === "admin") return rows;

  switch (table) {
    case "bookings":
    case "invoices":
      if (myPractice) return rows.filter((r) => r.practice_id === myPractice);
      if (myLocum && table === "bookings") return rows.filter((r) => r.locum_id === myLocum);
      return [];
    case "compliance_documents":
      return myLocum ? rows.filter((r) => r.locum_id === myLocum) : [];
    case "admin_users":
      return [];
    default:
      return rows;
  }
}

class MockQuery implements PromiseLike<Result> {
  private rows: Row[];
  private head = false;
  private wantCount = false;
  private one: "single" | "maybe" | null = null;
  private mutation: { kind: "insert" | "update" | "upsert" | "delete"; payload?: unknown } | null = null;
  private limitN: number | null = null;

  constructor(private table: string, rows: Row[]) {
    this.rows = [...rows];
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }

  private filter(fn: (r: Row) => boolean) {
    // Filters on columns a sample row doesn't have are ignored rather than
    // emptying the result.
    this.rows = this.rows.filter(fn);
    return this;
  }
  private has(r: Row, col: string) {
    return Object.prototype.hasOwnProperty.call(r, col);
  }

  eq(col: string, v: unknown) { return this.filter((r) => !this.has(r, col) || r[col] === v); }
  neq(col: string, v: unknown) { return this.filter((r) => !this.has(r, col) || r[col] !== v); }
  in(col: string, vs: unknown[]) { return this.filter((r) => !this.has(r, col) || vs.includes(r[col])); }
  gte(col: string, v: string | number) { return this.filter((r) => !this.has(r, col) || String(r[col]) >= String(v)); }
  gt(col: string, v: string | number) { return this.filter((r) => !this.has(r, col) || String(r[col]) > String(v)); }
  lte(col: string, v: string | number) { return this.filter((r) => !this.has(r, col) || String(r[col]) <= String(v)); }
  lt(col: string, v: string | number) { return this.filter((r) => !this.has(r, col) || String(r[col]) < String(v)); }
  is(col: string, v: null | boolean) { return this.filter((r) => !this.has(r, col) || (r[col] ?? null) === v); }
  not(col: string, op: string, v: unknown) {
    if (op === "is" && v === null) return this.filter((r) => !this.has(r, col) || r[col] != null);
    return this;
  }
  match(obj: Row) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? -1 : 1;
    this.rows.sort((a, b) => (String(a[col] ?? "") > String(b[col] ?? "") ? dir : -dir));
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.rows = this.rows.slice(from, to + 1); return this; }

  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  insert(payload: unknown) { this.mutation = { kind: "insert", payload }; return this; }
  upsert(payload: unknown) { this.mutation = { kind: "upsert", payload }; return this; }
  update(payload: unknown) { this.mutation = { kind: "update", payload }; return this; }
  delete() { this.mutation = { kind: "delete" }; return this; }

  private resolve(): Result {
    if (this.limitN != null) this.rows = this.rows.slice(0, this.limitN);

    if (this.mutation) {
      // Writes change nothing. Return something plausible so the calling
      // action's success path (and any redirect) still works.
      const payload = this.mutation.payload;
      const first = Array.isArray(payload) ? payload[0] : payload;
      let row: Row | null = null;
      if (this.mutation.kind === "update") {
        row = this.rows[0] ? { ...this.rows[0], ...(first as Row) } : null;
      } else if (this.mutation.kind === "insert" || this.mutation.kind === "upsert") {
        // An inserted booking "lands" on an existing sample booking so the
        // redirect to its detail page has something to show.
        const existing = this.rows[0] ?? null;
        row = existing ? { ...existing } : { id: "preview", ...(first as Row) };
      }
      return { data: this.one ? row : row ? [row] : [], error: null, count: null };
    }

    const count = this.wantCount ? this.rows.length : null;
    if (this.head) return { data: null, error: null, count };
    if (this.one) return { data: this.rows[0] ?? null, error: null, count };
    return { data: this.rows, error: null, count };
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

function hoursBetween(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return (bh * 60 + bm - (ah * 60 + am)) / 60;
}

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function createMockClient(role: MockRole): unknown {
  const { tables } = buildMockData();
  const user = mockUser(role);

  const client = {
    from(table: string) {
      return new MockQuery(table, visibleRows(table, tables[table] ?? [], role));
    },

    rpc(name: string, args: Record<string, unknown> = {}) {
      if (name === "search_locums") {
        const date = String(args.p_date);
        const start = String(args.p_start);
        const finish = String(args.p_finish);
        const hrs = hoursBetween(start, finish);
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        const dayType = dow === 0 || dow === 6 ? "weekend" : "weekday";
        const fees = tables.fees as Row[];

        const results = (tables.locums as Row[])
          .filter((l) => l.is_bookable && l.role_id === args.p_role_id)
          .filter((l) => Number(l.years_experience) >= Number(args.p_min_years ?? 0))
          .map((l) => {
            const miles = milesBetween(
              Number(args.p_latitude), Number(args.p_longitude),
              Number(l.latitude), Number(l.longitude),
            );
            const rate = (tables.locum_rates as Row[]).find(
              (r) => r.locum_id === l.id && r.day_type === dayType && r.status === "approved",
            );
            const fee = fees.find(
              (f) => f.fee_type === "booking" && f.role_id === l.role_id && f.day_type === dayType,
            );
            const clash = (tables.bookings as Row[]).some(
              (b) =>
                b.locum_id === l.id && b.booking_date === date &&
                !["cancelled", "disputed"].includes(String(b.status)) &&
                String(b.start_time) < `${finish}:00` && String(b.finish_time) > `${start}:00`,
            );
            return { l, miles, rate, fee, clash };
          })
          .filter((x) => x.rate && x.fee && !x.clash)
          .filter((x) => x.miles <= Math.min(Number(args.p_max_miles ?? 20), Number(x.l.travel_radius_miles)))
          .map(({ l, miles, rate, fee }) => {
            const hourly = Number(rate!.hourly_rate);
            const locumTotal = Math.round(hourly * hrs * 100) / 100;
            return {
              locum_id: l.id,
              full_name: (l.profiles as Row).full_name,
              years_experience: l.years_experience,
              distance_miles: Math.round(miles * 10) / 10,
              hourly_rate: hourly,
              locum_total: locumTotal,
              booking_fee: Number(fee!.amount),
              total_practice_cost: locumTotal + Number(fee!.amount),
            };
          })
          .sort((a, b) => a.distance_miles - b.distance_miles);

        return Promise.resolve({ data: results, error: null });
      }
      if (name === "refresh_compliance_statuses") return Promise.resolve({ data: 0, error: null });
      return Promise.resolve({ data: "preview", error: null });
    },

    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: {
          message: "Preview mode is on — switch accounts from /dev instead of signing in.",
          code: "preview_mode",
          status: 400,
        },
      }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user }, error: null }),
      exchangeCodeForSession: async () => ({ data: { session: null, user }, error: null }),
    },

    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        remove: async () => ({ data: [], error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "/dev?file=preview" }, error: null }),
      }),
    },
  };

  return client;
}
