import { formatDistanceToNow } from "date-fns";

const TZ = "Asia/Kolkata";

function formatWithIntl(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: TZ }).format(date);
}

function toDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d) : d;
}

export function formatTimeIST(date: string | Date): string {
  return formatWithIntl(toDate(date), { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDateTimeIST(date: string | Date): string {
  return formatWithIntl(toDate(date), {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(",", " ·");
}

export function formatDateIST(date: string | Date): string {
  return formatWithIntl(toDate(date), { month: "short", day: "numeric", year: "numeric" });
}

export function formatShortIST(date: string | Date): string {
  return formatWithIntl(toDate(date), {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(",", " ·");
}

export function toLocaleIST(date: string | Date): string {
  return toDate(date).toLocaleString("en-IN", { timeZone: TZ });
}

export function relativeTime(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true });
}
