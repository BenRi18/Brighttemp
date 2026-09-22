export const metadata = { title: "FAQs — Brighttemp" };

const FAQS: [string, string][] = [
  ["How does the locum actually get paid?", "Directly by the practice, at the hourly rate shown on their profile at the time of booking. Brighttemp never holds or deducts from that money. The only invoice we raise is our own booking fee, to the practice."],
  ["Does it cost a locum anything to join?", "No. Registration is free, there's no subscription, and we don't take a percentage of what you earn."],
  ["Can I book a locum for the same day?", "Yes, if a compliant locum has that day marked as available. Same-day bookings are flagged automatically and carry a higher booking fee, and may need a quick approval from us before they're confirmed."],
  ["Who decides the hourly rate?", "The locum does. They set it on their profile and can request a change at any time. Practices see the rate before they book."],
  ["What happens if we need to cancel?", "You can cancel from your bookings page. The system records who cancelled, when, and how much notice was given, then applies the published cancellation fee if it falls inside the notice window."],
  ["How long does approval take?", "New practices and locums are both reviewed before they can book or appear in search. For locums that means checking six compliance documents, so upload them at registration to avoid a wait."],
];

export default function FaqsPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight">Questions we get asked.</h1>
      <div className="mt-10 border-t border-line">
        {FAQS.map(([q, a]) => (
          <details key={q} className="border-b border-line">
            <summary className="cursor-pointer py-5 pr-10 text-lg font-semibold">{q}</summary>
            <p className="max-w-[70ch] pb-5 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
