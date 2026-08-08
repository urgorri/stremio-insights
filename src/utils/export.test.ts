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

  it("should convert empty array to valid JSON", () => {
    const jsonStr = convertToJSON([]);
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toHaveLength(0);
    expect(parsed).toEqual([]);
  });

  it("should convert events to valid CSV with headers and escaped fields", () => {
    const csvStr = convertToCSV(mockEvents);
    const lines = csvStr.split("\n");
    expect(lines[0]).toContain("IMDb ID,Title,Type");
    expect(lines[1]).toContain("tt1234567");
    expect(lines[1]).toContain("Dune Part Two");
    expect(lines[1]).toContain("Denis Villeneuve");
  });

  it("should escape commas, double quotes, and newlines properly in CSV", () => {
    const specialEvents: PlaybackEvent[] = [
      {
        ...mockEvents[0],
        title: 'Title with, comma',
        plot: 'Plot with "quotes"',
        episode_title: 'Episode \n with newline'
      }
    ];

    const csvStr = convertToCSV(specialEvents);
    const lines = csvStr.split("\n");
    // "Title with, comma" -> should be "\"Title with, comma\""
    expect(lines[1]).toContain("\"Title with, comma\"");
    // "Episode \n with newline" -> should be "\"Episode \n with newline\""
    // Since lines is split by \n, this will span lines[1] and lines[2]
    // So we can just check the raw string for the escaped version
    expect(csvStr).toContain("\"Episode \n with newline\"");
  });

  it("should output empty strings for null/undefined fields in CSV", () => {
    const emptyEvents: PlaybackEvent[] = [
      {
        imdb_id: "tt9999999",
        title: "Unknown",
        type: "movie",
        started_at: "2026-07-25T22:31:00.000Z",
        finished_at: "2026-07-25T23:31:00.000Z",
        progress: 100,
        watch_count: 1,
        duration: 0,
        time_watched: 0,
        // intentionally omitting genres, year, season, episode, episode_title, directors
      }
    ];

    const csvStr = convertToCSV(emptyEvents);
    const lines = csvStr.split("\n");
    // Should have a bunch of commas at the end for empty fields
    // e.g. ... ,,,
    expect(lines[1]).toContain("tt9999999,Unknown,movie,,,,");
  });
});
