import type { BookingStatus, AccountStatus, ComplianceDocument } from "@/lib/database.types";

type Tone = "neutral" | "amber" | "mint" | "red" | "pine";

const TONES: Record<Tone, string> = {
  neutral: "bg-[#EAF0EA] text-muted",
  amber: "bg-[#FFF7E0] text-[#54451A] border border-[#F0DFA8]",
  mint: "bg-[#E6F6F0] text-[#0B5E47]",
  red: "bg-red-50 text-red-800 border border-red-200",
  pine: "bg-pine text-white",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const BOOKING_TONE: Record<BookingStatus, Tone> = {
  requested: "amber",
  accepted: "pine",
  confirmed: "mint",
  completed: "neutral",
  cancelled: "red",
  disputed: "red",
};

const BOOKING_LABEL: Record<BookingStatus, string> = {
  requested: "Awaiting locum",
  accepted: "Accepted",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export const BookingBadge = ({ status }: { status: BookingStatus }) => (
  <Badge tone={BOOKING_TONE[status]}>{BOOKING_LABEL[status]}</Badge>
);

const ACCOUNT_TONE: Record<AccountStatus, Tone> = {
  pending: "amber",
  approved: "mint",
  rejected: "red",
  suspended: "red",
};

export const AccountBadge = ({ status }: { status: AccountStatus }) => (
  <Badge tone={ACCOUNT_TONE[status]}>{status}</Badge>
);

const DOC_TONE: Record<ComplianceDocument["status"], Tone> = {
  pending: "amber",
  under_review: "amber",
  approved: "mint",
  expiring_soon: "amber",
  expired: "red",
  rejected: "red",
};

export const DocumentBadge = ({ status }: { status: ComplianceDocument["status"] }) => (
  <Badge tone={DOC_TONE[status]}>{status.replace(/_/g, " ")}</Badge>
);
