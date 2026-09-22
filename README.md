# Brighttemp — Next.js app

Next.js 15 (App Router) + Supabase. Typechecks clean against the schema in
`supabase/migrations/`.

## Setup

```bash
cp .env.example .env.local        # fill in from Supabase → Settings → API
npm install
npm run dev
```

Apply the migrations in order, then create your first admin:

```sql
select public.grant_admin('you@brighttemp.co.uk', 'super_admin');
```

Regenerate types whenever the schema changes:

```bash
npm run types     # supabase gen types typescript --local > lib/database.types.ts
```

## How auth is wired

**Signup → profile is a database trigger, not application code.**
`handle_new_user()` fires on insert into `auth.users`, reads `user_type` and
`full_name` out of the signup metadata, and creates the profile in the same
transaction. There is never a moment where a session exists without a profile,
which is the usual source of "cannot read properties of null" on first login.

**`user_type` is mirrored into `app_metadata`**, so it rides in the JWT and the
middleware can route `/practice`, `/locum` and `/admin` with no database query
on every request. `app_metadata` is not writable by the user; `user_metadata`
would be, which is why the role does not live there.

**Registration is deliberately two steps.** Signup collects name, email and
password only. The practice or locum record is created after confirmation, in
`/onboarding/*`, because RLS needs `auth.uid()` to attach the row to the right
person — and because a 12-field form before you have confirmed your email is a
bad first impression.

**The middleware calls `getUser()`, not `getSession()`.** `getSession()` trusts
the cookie without revalidating it. Anything making an authorisation decision
must use `getUser()`.

**Approval gates live in layouts, not middleware.** `requirePractice()` sends an
unfinished registration to onboarding and an unapproved practice to `/pending`,
so every page under `/practice` can assume an approved practice exists.

## What the server actions do and don't trust

Actions validate with Zod, then let the database enforce the rules. The
onboarding action inserts a practice without setting `status` — RLS only permits
`pending`, and the column grants stop a practice writing `trust_level` at all.
The app never has to remember to be careful; it cannot succeed at being careless.

Sign-in failures return one vague message on purpose. A precise "no account with
that email" is an account enumeration oracle.

`lib/supabase/admin.ts` is the only service-role client and is marked
`server-only`. Use it for the notification sender and the nightly compliance
job. A signed-in admin's actions should go through the normal server client so
their own policies and the audit log still apply.

## Layout

`app/` routes and gates. `features/` domain logic. `lib/` generic infrastructure
that would survive a change of product.

```
app/(marketing)/       public site — home, pricing, faqs
app/(auth)/            login, register, reset, pending
app/(onboarding)/      practice and locum profile creation
app/(practice)/        dashboard, search, bookings, favourites, invoices, settings
app/(locum)/           shifts, availability, documents, rates, profile
app/(admin)/           overview, approvals, documents, bookings, invoices, fees
app/api/cron/          nightly compliance sweep

features/auth/         actions, schema, session gates
features/search/       search_locums wrapper + search UI
features/bookings/     request, accept, cancel, complete
features/compliance/   uploads, review queue, signed URLs
features/locums/       availability, rates, profile
features/practices/    settings, favourites, team
features/invoicing/    issue, record payment
features/admin/        approvals, fees, stats
features/notifications/ queue writer

lib/supabase/          client, server, admin (service role), middleware
lib/database.types.ts  generated — do not hand-edit
lib/geocode.ts         postcode → lat/lng
lib/format.ts          money, dates, notice hours
```

Each feature follows the same split: `actions.ts` is `"use server"` and mutates,
`queries.ts` is `"server-only"` and reads, `schema.ts` holds the Zod rules. Mixing
reads into an actions file turns a helper into a public POST endpoint.

## Where the rules actually live

The application deliberately does not re-implement the booking rules:

- **Pricing.** `requestBooking` sends no fee at all — `price_booking` derives it
  from the fees table, so a tampered form cannot buy a cheaper booking.
- **Search.** Compliance, distance, the locum's own travel radius and clashing
  bookings are all filtered inside `search_locums`.
- **Status transitions.** Who may move a booking from one state to another is a
  trigger, not an `if`. The UI only decides which buttons to show.
- **Cancellation.** Goes through the `cancel_booking` RPC so notice hours and the
  fee are computed at the instant the status changes.
- **Visibility.** `is_bookable` is trigger-maintained. Approving the last
  outstanding document is what puts a locum into search; there is no separate
  activate step.

## Cron

`GET /api/cron/compliance` with `Authorization: Bearer $CRON_SECRET` calls
`refresh_compliance_statuses()`. Schedule it daily (Vercel Cron or pg_cron).
Without it, documents never roll into expiring_soon/expired on their own.

## Storage

Create a **private** bucket named `compliance`. Object paths are
`{locum_id}/{doc_type}/{filename}` — the storage policies in `0002_rls.sql`
key off the first path segment. Admins view files through
`/admin/compliance/view`, which issues a five-minute signed URL.

## Still to wire

- MFA for admin accounts (`supabase.auth.mfa`) before go-live.
- Rate limiting on the signup and reset actions.
- The notification worker. Rows land on the queue; nothing drains it yet.
- Practice team invitations (the table and policies exist; no UI).
