import { describe, expect, it } from "vitest";
import { computeAnalytics, groupEventsIntoTimeline } from "./stats";
import { PlaybackEvent } from "../types";

describe("Analytics & Statistics", () => {
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
    },
    {
      imdb_id: "tt9876543",
      title: "Superman",
      type: "movie",
      started_at: "2026-07-26T12:00:00.000Z",
      finished_at: "2026-07-26T14:00:00.000Z",
      progress: 100,
      watch_count: 1,
      duration: 7200000,
      time_watched: 7200000,
      genres: ["Sci-Fi", "Action"],
      year: 2025,
      directors: ["James Gunn"]
    },
    {
      imdb_id: "tt0000001:1:1",
      parent_id: "tt0000001",
      title: "Alien Earth",
      type: "series",
      season: 1,
      episode: 1,
      started_at: "2026-06-15T20:00:00.000Z",
      finished_at: "2026-06-15T21:00:00.000Z",
      progress: 100,
      watch_count: 1,
      duration: 3600000,
      time_watched: 3600000,
      genres: ["Sci-Fi", "Horror"],
      year: 2026,
      directors: ["Noah Hawley"]
    }
  ];

  it("should calculate correct aggregate totals", () => {
    const summary = computeAnalytics(mockEvents);
    expect(summary.totalMovies).toBe(2);
    expect(summary.totalSeries).toBe(1);
    expect(summary.totalWatchCount).toBe(5); // 3 (Dune) + 1 (Superman) + 1 (Alien Earth)
    expect(summary.estimatedWatchTime).toBe(6120000 + 7200000 + 3600000); // sum in ms
  });

  it("should calculate favorite genres, years, and directors correctly", () => {
    const summary = computeAnalytics(mockEvents);
    // Sci-Fi appears in all 3 events
    expect(summary.favoriteGenres[0]).toBe("Sci-Fi");
    expect(summary.favoriteDirectors).toContain("Denis Villeneuve");
    expect(summary.favoriteDirectors).toContain("James Gunn");
  });

  it("should group events into a proper hierarchical timeline", () => {
    const timeline = groupEventsIntoTimeline(mockEvents);

    // July 2026 should contain Superman and Dune Part Two
    expect(timeline["2026"]).toBeDefined();
    expect(timeline["2026"]["July"]).toBeDefined();
    expect(timeline["2026"]["July"]).toHaveLength(2);
    expect(timeline["2026"]["July"][0].title).toBe("Superman"); // newest first in month group

    // June 2026 should contain Alien Earth
    expect(timeline["2026"]["June"]).toBeDefined();
    expect(timeline["2026"]["June"]).toHaveLength(1);
    expect(timeline["2026"]["June"][0].title).toBe("Alien Earth");
  });
});
