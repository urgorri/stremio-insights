import { describe, expect, it, vi } from "vitest";
import {
  formatBuenosAiresDate,
  normalizeTimestamp,
  mergeWatchHistory,
  formatDate,
  normalizeReleaseYear,
  formatBuenosAiresDateOnly
} from "./date";

describe("Date Formatting - America/Argentina/Buenos_Aires", () => {
  it("should format dates in the correct DD-MM-YYYY HH:mm format for Buenos Aires", () => {
    // 2026-07-25 22:31 UTC corresponds to 2026-07-25 19:31 in Buenos Aires (-3 hours)
    const dateUtc = "2026-07-25T22:31:00.000Z";
    const formatted = formatBuenosAiresDate(dateUtc);
    expect(formatted).toBe("25-07-2026 19:31");
  });

  it("should handle morning times and padding correctly", () => {
    // 2026-07-25 09:05 UTC corresponds to 2026-07-25 06:05 in Buenos Aires
    const dateUtc = "2026-07-25T09:05:00.000Z";
    const formatted = formatBuenosAiresDate(dateUtc);
    expect(formatted).toBe("25-07-2026 06:05");
  });

  it("should gracefully handle invalid date inputs", () => {
    const formatted = formatBuenosAiresDate("invalid-date-string");
    expect(formatted).toBe("");
  });

  it("should fallback to local formatting if Intl.DateTimeFormat fails for full date", () => {
    // Mock Intl.DateTimeFormat to throw an error
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl error");
    });

    const dateStr = "2026-07-25T22:31:00.000Z";
    const d = new Date(dateStr);
    const formatted = formatBuenosAiresDate(dateStr);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const expected = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    expect(formatted).toBe(expected);

    // Restore the mock
    spy.mockRestore();
  });
});

describe("Utility Functions - Timestamps and Merging", () => {
  it("should normalize timestamps correctly", () => {
    expect(normalizeTimestamp(1783997771783)).toBe(1783997771783);
    expect(normalizeTimestamp("2026-07-25T22:31:00.000Z")).toBe(new Date("2026-07-25T22:31:00.000Z").getTime());
    expect(normalizeTimestamp(new Date(1783997771783))).toBe(1783997771783);
    expect(normalizeTimestamp(null)).toBe(0);
    expect(normalizeTimestamp(undefined)).toBe(0);
    expect(normalizeTimestamp("")).toBe(0);
  });

  it("should format timestamps using formatDate helper", () => {
    const dateUtc = "2026-07-25T22:31:00.000Z";
    expect(formatDate(dateUtc)).toBe("25-07-2026 19:31");
  });

  it("Case A: should handle merging when the item is a new record", () => {
    const stremioTimestamp = 1783997771783;
    const merged = mergeWatchHistory(undefined, stremioTimestamp);
    expect(merged.firstWatched).toBe(stremioTimestamp);
    expect(merged.lastWatched).toBe(stremioTimestamp);
  });

  it("Case B: should preserve firstWatched and update lastWatched when incoming timestamp is newer", () => {
    const existing = {
      firstWatched: 1700000000000,
      lastWatched: 1750000000000
    };
    const stremioTimestamp = 1783997771783;
    const merged = mergeWatchHistory(existing, stremioTimestamp);
    expect(merged.firstWatched).toBe(1700000000000);
    expect(merged.lastWatched).toBe(stremioTimestamp);
  });

  it("Case C: should preserve firstWatched and not overwrite lastWatched with older data when incoming is older", () => {
    const existing = {
      firstWatched: 1700000000000,
      lastWatched: 1783997771783
    };
    const stremioTimestamp = 1750000000000;
    const merged = mergeWatchHistory(existing, stremioTimestamp);
    expect(merged.firstWatched).toBe(1700000000000);
    expect(merged.lastWatched).toBe(1783997771783); // Kept newer timestamp
  });
});

describe("New Utility Functions - normalizeReleaseYear and formatBuenosAiresDateOnly", () => {
  it("should normalize release year correctly", () => {
    expect(normalizeReleaseYear("2005-")).toBe("2005");
    expect(normalizeReleaseYear("1999-2007")).toBe("1999");
    expect(normalizeReleaseYear("2026")).toBe("2026");
    expect(normalizeReleaseYear("")).toBe("Unknown");
    expect(normalizeReleaseYear(null)).toBe("Unknown");
    expect(normalizeReleaseYear(undefined)).toBe("Unknown");
  });

  it("should format dates as DD-MM-YYYY in Buenos Aires timezone", () => {
    const dateUtc = "2026-07-25T22:31:00.000Z"; // 19:31 in Buenos Aires (-3 hours)
    expect(formatBuenosAiresDateOnly(dateUtc)).toBe("25-07-2026");
  });

  it("should fallback to local formatting if Intl.DateTimeFormat fails for date only", () => {
    // Mock Intl.DateTimeFormat to throw an error
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl error");
    });

    const dateStr = "2026-07-25T22:31:00.000Z";
    const d = new Date(dateStr);
    const formatted = formatBuenosAiresDateOnly(dateStr);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const expected = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

    expect(formatted).toBe(expected);

    // Restore the mock
    spy.mockRestore();
  });
});
