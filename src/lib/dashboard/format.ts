export function safeTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== "UTC") return tz;
    return typeof window === "undefined"
      ? (process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || "Asia/Manila")
      : (tz || "Asia/Manila");
  } catch {
    return "Asia/Manila";
  }
}

export function formatDate(dateInput: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: safeTimeZone(),
  }).format(new Date(dateInput));
}

export function formatTime(dateInput: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeTimeZone(),
  }).format(new Date(dateInput));
}

export function formatDateTime(dateInput: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeTimeZone(),
  }).format(new Date(dateInput));
}

export function formatDateTimeWithZone(dateInput: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: safeTimeZone(),
  }).format(new Date(dateInput));
}

export function formatTimeNow() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeTimeZone(),
  }).format(new Date());
}

/**
 * Converts a date string (YYYY-MM-DD) and time string (HH:mm) entered by the user
 * in their local browser timezone into a precise, unambiguous UTC ISO-8601 string.
 */
export function toUtcIsoFromLocal(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const localDate = new Date(y, m - 1, d, hh, mm, 0);
  return localDate.toISOString();
}

/**
 * Returns YYYY-MM-DD for a Date object in the user's local timezone.
 * Unlike date.toISOString().split("T")[0], this does NOT shift backwards across midnight in positive UTC offsets.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns HH:mm (24-hour) for a Date object in the user's local timezone.
 */
export function toLocalTimeKey(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

