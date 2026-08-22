/**
 * Formats a date using America/Argentina/Buenos_Aires timezone
 * and the specific format: DD-MM-YYYY HH:mm
 */
export function formatBuenosAiresDate(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const parts = dtf.formatToParts(date);
    const partMap = parts.reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);

    const day = partMap.day || "01";
    const month = partMap.month || "01";
    const year = partMap.year || "2026";
    const hour = partMap.hour || "00";
    const minute = partMap.minute || "00";

    return `${day}-${month}-${year} ${hour}:${minute}`;
  } catch (error) {
    // Fallback if Intl fails
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = new Date(dateInput);
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/**
 * Normalizes any timestamp representation into a Unix timestamp in milliseconds.
 */
export function normalizeTimestamp(value: string | Date | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Date.parse(value);
  if (!isNaN(parsed)) {
    return parsed;
  }
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return num;
  }
  return 0;
}

/**
 * Merges existing watch history timestamps with an incoming Stremio timestamp.
 * - If a record already exists:
 *   - Preserve firstWatched.
 *   - Update lastWatched only if the Stremio timestamp is newer.
 */
export function mergeWatchHistory(
  existing: { firstWatched?: number; lastWatched?: number; started_at?: string; finished_at?: string } | undefined,
  incomingTimestamp: number
): { firstWatched: number; lastWatched: number } {
  const normalizedIncoming = normalizeTimestamp(incomingTimestamp);

  if (!existing) {
    return {
      firstWatched: normalizedIncoming,
      lastWatched: normalizedIncoming,
    };
  }

  // Preserve firstWatched if it exists, otherwise fall back to started_at or incoming
  let firstWatched = existing.firstWatched ? normalizeTimestamp(existing.firstWatched) : 0;
  if (!firstWatched && existing.started_at) {
    firstWatched = normalizeTimestamp(existing.started_at);
  }
  if (!firstWatched) {
    firstWatched = normalizedIncoming;
  }

  // Update lastWatched only if the Stremio timestamp is newer
  let lastWatched = existing.lastWatched ? normalizeTimestamp(existing.lastWatched) : 0;
  if (!lastWatched && existing.finished_at) {
    lastWatched = normalizeTimestamp(existing.finished_at);
  }
  if (!lastWatched) {
    lastWatched = normalizedIncoming;
  } else if (normalizedIncoming > lastWatched) {
    lastWatched = normalizedIncoming;
  }

  return { firstWatched, lastWatched };
}

/**
 * Normalizes release year string to a 4-digit year or "Unknown".
 * "2005-"      -> "2005"
 * "1999-2007"  -> "1999"
 * "2026"       -> "2026"
 * ""           -> "Unknown"
 * null         -> "Unknown"
 * undefined    -> "Unknown"
 */
export function normalizeReleaseYear(yearInput: any): string {
  if (yearInput === null || yearInput === undefined) return "Unknown";
  const str = String(yearInput).trim();
  if (!str) return "Unknown";
  const match = str.match(/\d{4}/);
  if (match) {
    return match[0];
  }
  return "Unknown";
}

/**
 * Formats a date using America/Argentina/Buenos_Aires timezone
 * and returns only the date part: DD-MM-YYYY
 */
export function formatBuenosAiresDateOnly(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    const parts = dtf.formatToParts(date);
    const partMap = parts.reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);

    const day = partMap.day || "01";
    const month = partMap.month || "01";
    const year = partMap.year || "2026";

    return `${day}-${month}-${year}`;
  } catch (error) {
    // Fallback if Intl fails
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = new Date(dateInput);
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  }
}
