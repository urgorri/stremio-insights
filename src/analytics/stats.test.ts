import { describe, expect, it } from "vitest";
import { computeAnalytics, groupEventsIntoTimeline, getFirstWatchTime, getWatchTime } from "./stats";
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

  describe("getFirstWatchTime and getWatchTime helper functions", () => {
    it("getFirstWatchTime should return normalized firstWatched when present", () => {
      const event = {
        imdb_id: "tt123",
        title: "Test Movie",
        type: "movie",
        firstWatched: 1700000000000,
        started_at: "2026-01-01T00:00:00.000Z"
      } as unknown as PlaybackEvent;
      expect(getFirstWatchTime(event)).toBe(1700000000000);
    });

    it("getFirstWatchTime should fall back to normalized started_at when firstWatched is missing", () => {
      const event = {
        imdb_id: "tt123",
        title: "Test Movie",
        type: "movie",
        started_at: "2026-01-01T00:00:00.000Z"
      } as unknown as PlaybackEvent;
      const expectedTs = new Date("2026-01-01T00:00:00.000Z").getTime();
      expect(getFirstWatchTime(event)).toBe(expectedTs);
    });

    it("getFirstWatchTime should return 0 when neither firstWatched nor started_at is provided", () => {
      const event = {
        imdb_id: "tt123",
        title: "Test Movie",
        type: "movie"
      } as unknown as PlaybackEvent;
      expect(getFirstWatchTime(event)).toBe(0);
    });

    it("getWatchTime should return normalized lastWatched when present", () => {
      const event = {
        imdb_id: "tt123",
        title: "Test Movie",
        type: "movie",
        lastWatched: 1750000000000,
        finished_at: "2026-02-01T00:00:00.000Z",
        started_at: "2026-01-01T00:00:00.000Z"
      } as unknown as PlaybackEvent;
      expect(getWatchTime(event)).toBe(1750000000000);
    });

    it("getWatchTime should fall back to finished_at when lastWatched is missing", () => {
      const event = {
        imdb_id: "tt123",
        title: "Test Movie",
        type: "movie",
        finished_at: "2026-02-01T00:00:00.000Z",
        started_at: "2026-01-01T00:00:00.000Z"
      } as unknown as PlaybackEvent;
      const expectedTs = new Date("2026-02-01T00:00:00.000Z").getTime();
      expect(getWatchTime(event)).toBe(expectedTs);
    });

    it("getWatchTime should fall back to started_at when lastWatched and finished_at are missing", () => {
      const event = {
        imdb_id: "tt123",
        title: "Test Movie",
        type: "movie",
        started_at: "2026-01-01T00:00:00.000Z"
      } as unknown as PlaybackEvent;
      const expectedTs = new Date("2026-01-01T00:00:00.000Z").getTime();
      expect(getWatchTime(event)).toBe(expectedTs);
    });

    it("getWatchTime should return 0 when no watch timestamp fields are present", () => {
      const event = {
        imdb_id: "tt123",
        title: "Test Movie",
        type: "movie"
      } as unknown as PlaybackEvent;
      expect(getWatchTime(event)).toBe(0);
    });
  });

  it("should calculate correct aggregate totals", () => {
    const summary = computeAnalytics(mockEvents);
    expect(summary.totalMovies).toBe(2);
    expect(summary.totalSeries).toBe(1);
    expect(summary.totalWatchCount).toBe(5);
    expect(summary.estimatedWatchTime).toBe(6120000 + 7200000 + 3600000);
  });

  it("should calculate favorite genres, years, and directors correctly", () => {
    const summary = computeAnalytics(mockEvents);
    expect(summary.favoriteGenres[0]).toBe("Sci-Fi");
    expect(summary.favoriteDirectors).toContain("Denis Villeneuve");
    expect(summary.favoriteDirectors).toContain("James Gunn");
  });

  it("should handle single string director and missing IMDb rating gracefully", () => {
    const events: PlaybackEvent[] = [
      {
        imdb_id: "tt999",
        title: "Single Director Movie",
        type: "movie",
        director: "Christopher Nolan",
        imdbRating: "N/A",
        releaseYear: "2020",
        started_at: "2026-01-01T00:00:00.000Z"
      } as unknown as PlaybackEvent
    ];
    const summary = computeAnalytics(events);
    expect(summary.topDirectors).toEqual([{ name: "Christopher Nolan", count: 1 }]);
    expect(summary.avgImdbRating).toBe("0.0");
  });

  it("should group events into a proper hierarchical timeline", () => {
    const timeline = groupEventsIntoTimeline(mockEvents);

    expect(timeline["2026"]).toBeDefined();
    expect(timeline["2026"]["July"]).toBeDefined();
    expect(timeline["2026"]["July"]).toHaveLength(2);
    expect(timeline["2026"]["July"][0].title).toBe("Superman");

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
          started_at: "2023-01-01T12:00:00.000Z",
          finished_at: "2023-02-01T12:00:00.000Z",
          lastWatched: new Date("2023-03-01T12:00:00.000Z").getTime(),
        } as unknown as PlaybackEvent,
        {
          imdb_id: "tt2",
          title: "Priority Test 2",
          type: "movie",
          started_at: "2024-01-01T12:00:00.000Z",
          finished_at: "2024-02-01T12:00:00.000Z",
        } as PlaybackEvent
      ];

      const timeline = groupEventsIntoTimeline(events);
      expect(timeline["2023"]).toBeDefined();
      expect(timeline["2023"]["March"]).toBeDefined();
      expect(timeline["2023"]["March"][0].title).toBe("Priority Test");

      expect(timeline["2024"]).toBeDefined();
      expect(timeline["2024"]["February"]).toBeDefined();
      expect(timeline["2024"]["February"][0].title).toBe("Priority Test 2");
    });
  });

  describe("Heatmap tests", () => {
    it("should calculate heatmap for the current year only", () => {
      const currentYear = new Date().getFullYear();
      const jan5th = new Date(currentYear, 0, 5, 12, 0, 0);
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
      const currentYearCell = summary.heatmap.find(item => item.month === 1 && item.day === 5);
      expect(currentYearCell).toBeDefined();
      expect(currentYearCell?.count).toBe(1);
    });
  });
});
