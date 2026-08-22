import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { needsRepair, fetchCinemeta } from "./index";
import { CONTENT_TYPE_MOVIE, CONTENT_TYPE_SERIES, GENRE_HISTORICAL, RELEASE_YEAR_UNKNOWN } from "../utils/constants";

describe("needsRepair", () => {
  it("should return true if item is falsy", () => {
    expect(needsRepair(null)).toBe(true);
    expect(needsRepair(undefined)).toBe(true);
  });

  it("should return true if item type does not match correctType", () => {
    const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John", releaseYear: "2020" };
    expect(needsRepair(item, CONTENT_TYPE_SERIES)).toBe(true);
  });

  it("should return false for valid movie", () => {
    const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John Doe", releaseYear: "2020" };
    expect(needsRepair(item)).toBe(false);
  });

  it("should return false for valid series (director can be missing)", () => {
    const item = { type: CONTENT_TYPE_SERIES, genres: ["Drama"], releaseYear: "2021" };
    expect(needsRepair(item)).toBe(false);
  });

  describe("genres validation", () => {
    it(`should return true if genres array contains only '${GENRE_HISTORICAL}'`, () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: [GENRE_HISTORICAL], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it(`should return false if genres array contains '${GENRE_HISTORICAL}' and others`, () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: [GENRE_HISTORICAL, "Action"], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(false);
    });

    it("should return true if genres is missing", () => {
      const item = { type: CONTENT_TYPE_MOVIE, director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if genres is empty array", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: [], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if genres is not an array", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: "Action", director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });
  });

  describe("director validation", () => {
    it("should return true for movie if director is null", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: null, releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true for movie if director is undefined", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return false for series if director is null", () => {
      const item = { type: CONTENT_TYPE_SERIES, genres: ["Action"], director: null, releaseYear: "2020" };
      expect(needsRepair(item)).toBe(false);
    });
  });

  describe("releaseYear validation", () => {
    it("should return true if releaseYear is missing", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John" };
      expect(needsRepair(item)).toBe(true);
    });

    it(`should return true if releaseYear is '${RELEASE_YEAR_UNKNOWN}'`, () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John", releaseYear: RELEASE_YEAR_UNKNOWN };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if releaseYear is malformed (not 4 digits)", () => {
      const cases = ["20", "20204", "abcd", "20-20", "202X"];
      cases.forEach(year => {
        const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John", releaseYear: year };
        expect(needsRepair(item)).toBe(true);
      });
    });
  });
});

describe("fetchCinemeta", () => {
  let originalFetch: typeof global.fetch;
  let originalConsoleWarn: typeof console.warn;
  let consoleWarnMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalConsoleWarn = console.warn;
    consoleWarnMock = vi.fn();
    console.warn = consoleWarnMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.warn = originalConsoleWarn;
    vi.restoreAllMocks();
  });

  it("should handle network/fetch error gracefully and log a warning", async () => {
    const fetchError = new Error("Network offline");
    global.fetch = vi.fn().mockRejectedValue(fetchError);

    const stats = {
      apiCallsCount: 0,
      cinemetaEnrichedCount: 0,
      omdbFallbackCount: 0,
      missingGenresCount: 0,
      missingDirectorsCount: 0,
      unknownReleaseYearsCount: 0
    };

    const ctx = {
      titleVal: "",
      resolvedType: "movie" as const,
      genres: [],
      director: null,
      directors: undefined,
      actors: [],
      runtime: "Unknown",
      plot: "",
      imdbRating: "",
      poster: "",
      releaseYear: "Unknown",
      sourceUsed: "none" as const
    };

    await expect(fetchCinemeta("tt1234567", "movie", stats, ctx)).resolves.not.toThrow();

    expect(stats.apiCallsCount).toBe(1);
    expect(consoleWarnMock).toHaveBeenCalledWith(
      "[METADATA] Cinemeta failed for tt1234567:",
      fetchError
    );
    expect(ctx.sourceUsed).toBe("none");
  });

  it("should populate context on successful fetch", async () => {
    const mockMetaData = {
      meta: {
        name: "Test Movie",
        type: "movie",
        genre: ["Action", "Sci-Fi"],
        director: ["Director One", "Director Two"],
        cast: ["Actor A", "Actor B"],
        description: "A test plot description.",
        runtime: "120 min",
        imdbRating: "8.5",
        poster: "https://example.com/poster.jpg",
        releaseInfo: "2022"
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockMetaData)
    } as unknown as Response);

    const stats = {
      apiCallsCount: 0,
      cinemetaEnrichedCount: 0,
      omdbFallbackCount: 0,
      missingGenresCount: 0,
      missingDirectorsCount: 0,
      unknownReleaseYearsCount: 0
    };

    const ctx = {
      titleVal: "",
      resolvedType: "movie" as const,
      genres: [],
      director: null,
      directors: undefined,
      actors: [],
      runtime: "Unknown",
      plot: "",
      imdbRating: "",
      poster: "",
      releaseYear: "Unknown",
      sourceUsed: "none" as const
    };

    await fetchCinemeta("tt1234567", "movie", stats, ctx);

    expect(stats.apiCallsCount).toBe(1);
    expect(ctx.sourceUsed).toBe("cinemeta");
    expect(ctx.titleVal).toBe("Test Movie");
    expect(ctx.resolvedType).toBe("movie");
    expect(ctx.genres).toEqual(["Action", "Sci-Fi"]);
    expect(ctx.director).toBe("Director One");
    expect(ctx.directors).toEqual(["Director One", "Director Two"]);
    expect(ctx.actors).toEqual(["Actor A", "Actor B"]);
    expect(ctx.plot).toBe("A test plot description.");
    expect(ctx.runtime).toBe("120 min");
    expect(ctx.imdbRating).toBe("8.5");
    expect(ctx.poster).toBe("https://example.com/poster.jpg");
    expect(ctx.releaseYear).toBe("2022");
  });

  it("should try fallback URL type if initial fetch returns no meta", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ meta: null })
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          meta: {
            name: "Fallback Series",
            type: "series",
            genres: ["Drama"],
            year: "2021"
          }
        })
      } as unknown as Response);

    global.fetch = fetchMock;

    const stats = {
      apiCallsCount: 0,
      cinemetaEnrichedCount: 0,
      omdbFallbackCount: 0,
      missingGenresCount: 0,
      missingDirectorsCount: 0,
      unknownReleaseYearsCount: 0
    };

    const ctx = {
      titleVal: "",
      resolvedType: "movie" as const,
      genres: [],
      director: null,
      directors: undefined,
      actors: [],
      runtime: "Unknown",
      plot: "",
      imdbRating: "",
      poster: "",
      releaseYear: "Unknown",
      sourceUsed: "none" as const
    };

    await fetchCinemeta("tt7654321", "movie", stats, ctx);

    expect(stats.apiCallsCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://v3-cinemeta.strem.io/meta/movie/tt7654321.json");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://v3-cinemeta.strem.io/meta/series/tt7654321.json");
    expect(ctx.sourceUsed).toBe("cinemeta");
    expect(ctx.titleVal).toBe("Fallback Series");
    expect(ctx.releaseYear).toBe("2021");
  });
});
