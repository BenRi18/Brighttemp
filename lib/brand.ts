/**
 * Two names, one company.
 *
 *   agency   — Brighttemp, the staffing agency. Money is owed to the agency,
 *              so invoices, fees and payment wording use this.
 *   platform — the booking site itself. Headers, page titles and emails
 *              about bookings use this.
 *
 * Change the platform name here and it changes everywhere.
 */
export const BRAND = {
  agency: "Brighttemp",
  platform: "Brighttemp Booking Hub",
  /** First word, for the logo; the rest is set beside it. */
  platformLead: "Brighttemp",
  platformTail: "Booking Hub",
  legalName: "Brighttemp Ltd",
  /** Companies House number. Required on the website, letterheads and invoices. */
  companyNumber: "12463035",
  supportEmail: "brighttemp@yahoo.com",
  supportPhone: "07960867701",
  /** Same number, in the form a phone dialler understands. */
  supportPhoneLink: "+447960867701",
} as const;
