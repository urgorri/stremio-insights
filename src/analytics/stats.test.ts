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

    // July 2026 should contain Superman and Dune Part Two, sorted descending (newest first)
    expect(timeline["2026"]).toBeDefined();
    expect(timeline["2026"]["July"]).toBeDefined();
    expect(timeline["2026"]["July"]).toHaveLength(2);
    expect(timeline["2026"]["July"][0].title).toBe("Superman"); // newest first in month group

    // June 2026 should contain Alien Earth
    expect(timeline["2026"]["June"]).toBeDefined();
    expect(timeline["2026"]["June"]).toHaveLength(1);
    expect(timeline["2026"]["June"][0].title).toBe("Alien Earth");
  });

  describe("groupEventsIntoTimeline", () => {
    it("should return an empty object for an empty array", () => {
    expect(groupEventsIntoTimeline([])).toEqual({});
  });

  it("should skip events without a valid timestamp", () => {
    const invalidEvents: PlaybackEvent[] = [
      {
        imdb_id: "tt1",
        title: "No Timestamp",
        type: "movie",
        // No started_at, finished_at, or lastWatched
      } as PlaybackEvent,
      {
        imdb_id: "tt2",
        title: "Invalid Timestamp String",
        type: "movie",
        started_at: "not-a-date",
      } as PlaybackEvent
    ];

    expect(groupEventsIntoTimeline(invalidEvents)).toEqual({});
  });

  it("should prioritize lastWatched over finished_at over started_at", () => {
    const events: PlaybackEvent[] = [
      {
        imdb_id: "tt1",
        title: "Priority Test",
        type: "movie",
        started_at: "2023-01-01T12:00:00.000Z", // January
        finished_at: "2023-02-01T12:00:00.000Z", // February
        lastWatched: "2023-03-01T12:00:00.000Z", // March (Should win)
      } as unknown as PlaybackEvent,
      {
        imdb_id: "tt2",
        title: "Priority Test 2",
        type: "movie",
        started_at: "2024-01-01T12:00:00.000Z", // January
        finished_at: "2024-02-01T12:00:00.000Z", // February (Should win)
      } as unknown as PlaybackEvent,
    ];

    const timeline = groupEventsIntoTimeline(events);
    expect(timeline["2023"]).toBeDefined();
    expect(timeline["2023"]["March"]).toBeDefined();
    expect(timeline["2023"]["March"][0].title).toBe("Priority Test");

    expect(timeline["2024"]).toBeDefined();
    expect(timeline["2024"]["February"]).toBeDefined();
    expect(timeline["2024"]["February"][0].title).toBe("Priority Test 2");
  });

  it("should properly group events crossing multiple years and months", () => {
    const events: PlaybackEvent[] = [
      {
        imdb_id: "tt1",
        title: "Dec 2023",
        type: "movie",
        started_at: "2023-12-15T12:00:00.000Z",
      } as PlaybackEvent,
      {
        imdb_id: "tt2",
        title: "Jan 2024",
        type: "movie",
        started_at: "2024-01-15T12:00:00.000Z",
      } as PlaybackEvent,
      {
        imdb_id: "tt3",
        title: "Jan 2024 (2)",
        type: "movie",
        started_at: "2024-01-20T12:00:00.000Z",
      } as PlaybackEvent,
      {
        imdb_id: "tt4",
        title: "Feb 2024",
        type: "movie",
        started_at: "2024-02-15T12:00:00.000Z",
      } as PlaybackEvent
    ];

    const timeline = groupEventsIntoTimeline(events);

    // Should contain both years
    expect(Object.keys(timeline)).toEqual(expect.arrayContaining(["2023", "2024"]));

    // Check 2023
    expect(timeline["2023"]["December"]).toBeDefined();
    expect(timeline["2023"]["December"]).toHaveLength(1);

    // Check 2024
    expect(timeline["2024"]["January"]).toBeDefined();
    expect(timeline["2024"]["January"]).toHaveLength(2);
    // Sort order: descending time
    expect(timeline["2024"]["January"][0].title).toBe("Jan 2024 (2)");
    expect(timeline["2024"]["January"][1].title).toBe("Jan 2024");

    expect(timeline["2024"]["February"]).toBeDefined();
    expect(timeline["2024"]["February"]).toHaveLength(1);
    });
  });

  describe("Heatmap tests", () => {
    it("should calculate heatmap for the current year only, mapping months horizontally and days vertically", () => {
    const currentYear = new Date().getFullYear();

    // Let's create an event on Jan 5th of current year.
    const jan5th = new Date(currentYear, 0, 5, 12, 0, 0);
    // Let's create an event on Jan 5th of previous year (should be ignored).
    const prevJan5th = new Date(currentYear - 1, 0, 5, 12, 0, 0);

    const testEvents: PlaybackEvent[] = [
      {
        imdb_id: "tt111",
        title: "Current Year Movie",
        type: "movie",
        started_at: jan5th.toISOString(),
        finished_at: jan5th.toISOString(),
        progress: 100,
        watch_count: 1,
        duration: 3600000,
        time_watched: 3600000,
      },
      {
        imdb_id: "tt222",
        title: "Previous Year Movie",
        type: "movie",
        started_at: prevJan5th.toISOString(),
        finished_at: prevJan5th.toISOString(),
        progress: 100,
        watch_count: 1,
        duration: 3600000,
        time_watched: 3600000,
      }
    ];

    const summary = computeAnalytics(testEvents);

    // Month 1 (January), Day 5
    const currentYearCell = summary.heatmap.find(item => item.month === 1 && item.day === 5);
    expect(currentYearCell).toBeDefined();
    expect(currentYearCell?.count).toBe(1); // Only current year movie should be counted

    // All other cells should be 0
    const otherCells = summary.heatmap.filter(item => !(item.month === 1 && item.day === 5));
    otherCells.forEach(cell => {
        expect(cell.count).toBe(0);
      });
    });
  });
});
