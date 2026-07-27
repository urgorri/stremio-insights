import { describe, expect, it } from "vitest";
import { formatBuenosAiresDate } from "./date";

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
});
