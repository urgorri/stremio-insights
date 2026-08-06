import { describe, expect, it } from "vitest";
import { convertToCSV, convertToJSON } from "./export";
import { PlaybackEvent } from "../types";

describe("Exporters", () => {
  const mockEvents: PlaybackEvent[] = [
    {
      imdb_id: "tt1234567",
      title: "Dune Part Two",
      type: "movie",
      started_at: "2026-07-25T22:31:00.000Z",
      finished_at: "2026-07-25T23:31:00.000Z",
      progress: 85,
      watch_count: 3,
      duration: 7200000,
      time_watched: 6120000,
      genres: ["Sci-Fi", "Adventure"],
      year: 2024,
      directors: ["Denis Villeneuve"]
    }
  ];

  it("should convert events to valid JSON", () => {
    const jsonStr = convertToJSON(mockEvents);
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Dune Part Two");
  });

  it("should convert events to valid CSV with headers and escaped fields", () => {
    const csvStr = convertToCSV(mockEvents);
    const lines = csvStr.split("\n");
    expect(lines[0]).toContain("IMDb ID,Title,Type");
    expect(lines[1]).toContain("tt1234567");
    expect(lines[1]).toContain("Dune Part Two");
    expect(lines[1]).toContain("Denis Villeneuve");
  });
});
