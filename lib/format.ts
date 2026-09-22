const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export const money = (n: number | null | undefined) => (n == null ? "—" : GBP.format(n));

export const hourly = (n: number | null | undefined) =>
  n == null ? "—" : `${GBP.format(n)}/hr`;

export function shiftDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function shiftTimes(start: string, finish: string) {
  return `${start.slice(0, 5)}–${finish.slice(0, 5)}`;
}

export function hoursBetween(start: string, finish: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [fh, fm] = finish.split(":").map(Number);
  return (fh * 60 + fm - (sh * 60 + sm)) / 60;
}

export const normalisePostcode = (pc: string) =>
  pc.trim().toUpperCase().replace(/\s+/g, "").replace(/^(.+)(\d[A-Z]{2})$/, "$1 $2");

export const noticeHours = (date: string, start: string) =>
  (new Date(`${date}T${start}`).getTime() - Date.now()) / 36e5;

/** Today in the Europe/London calendar, as YYYY-MM-DD. */
export function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function addDaysISO(days: number, from = todayISO()) {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
