/**
 * The demo preview is on in development and off in production, unless a
 * staging deployment opts in with ENABLE_DEMO_PREVIEW=true. Every entry point
 * (the /dev page, the sign-in action, the toolbar, the middleware) checks this,
 * so a production build cannot expose it by accident.
 */
export function demoPreviewEnabled() {
  return (
    process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_PREVIEW === "true"
  );
}

export type DemoAccount = {
  key: string;
  local: string;
  label: string;
  role: "practice" | "locum" | "admin";
  shows: string;
  pages: { href: string; label: string }[];
};

/** Must match scripts/create-demo-users.mjs and supabase/seed/demo_seed.sql. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "practice",
    local: "demo.practice",
    label: "Practice — Bright Smile Dental",
    role: "practice",
    shows: "Approved, trusted practice with upcoming, requested and past bookings.",
    pages: [
      { href: "/practice", label: "Dashboard" },
      { href: "/practice/search", label: "Find cover" },
      { href: "/practice/bookings", label: "Bookings" },
      { href: "/practice/favourites", label: "Favourites" },
      { href: "/practice/invoices", label: "Invoices" },
      { href: "/practice/settings", label: "Settings" },
    ],
  },
  {
    key: "locum",
    local: "demo.locum",
    label: "Locum — Amara Okafor (nurse)",
    role: "locum",
    shows: "Bookable nurse with a shift request waiting, a confirmed shift and a pending rate change.",
    pages: [
      { href: "/locum", label: "Shifts" },
      { href: "/locum/availability", label: "Availability" },
      { href: "/locum/compliance", label: "Documents" },
      { href: "/locum/rates", label: "Rates" },
      { href: "/locum/settings", label: "Profile" },
    ],
  },
  {
    key: "admin",
    local: "demo.admin",
    label: "Brighttemp admin",
    role: "admin",
    shows: "Super admin with a pending practice, a pending locum, documents and a rate change to review.",
    pages: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/approvals", label: "Approvals" },
      { href: "/admin/compliance", label: "Documents" },
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/invoices", label: "Invoices" },
      { href: "/admin/fees", label: "Fees" },
    ],
  },
  {
    key: "pendingPractice",
    local: "demo.pending-practice",
    label: "Practice awaiting approval",
    role: "practice",
    shows: "What a newly registered practice sees before Brighttemp approves it.",
    pages: [{ href: "/practice", label: "Holding page" }],
  },
  {
    key: "pendingLocum",
    local: "demo.pending-locum",
    label: "Locum awaiting approval",
    role: "locum",
    shows: "A new receptionist with documents still under review — hidden from search.",
    pages: [
      { href: "/locum", label: "Shifts" },
      { href: "/locum/compliance", label: "Documents" },
    ],
  },
];

export const PUBLIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faqs", label: "FAQs" },
  { href: "/login", label: "Sign in" },
  { href: "/register/practice", label: "Register a practice" },
  { href: "/register/locum", label: "Join as a locum" },
  { href: "/forgot-password", label: "Forgotten password" },
];

export function demoEmail(local: string) {
  return `${local}@${process.env.DEMO_EMAIL_DOMAIN ?? "example.com"}`;
}
