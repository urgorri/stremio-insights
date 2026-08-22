import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { needsRepair, runSyncPipeline } from "./index";
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

describe("runSyncPipeline performance & storage optimization", () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock localStorage
    const storageMap = new Map<string, string>();
    storageMap.set("profile", JSON.stringify({ auth: { key: "test_auth_key" } }));
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: (key: string) => storageMap.get(key) || null,
        setItem: (key: string, val: string) => storageMap.set(key, val),
        removeItem: (key: string) => storageMap.delete(key),
        clear: () => storageMap.clear()
      },
      writable: true
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
  });

  it("should fetch omdb_api_key in a single storage get call during pipeline execution", async () => {
    const itemsCount = 10;
    const datastoreMetaItems = Array.from({ length: itemsCount }, (_, i) => [
      `tt100000${i}`,
      1700000000000 + i * 1000
    ]);

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.includes("datastoreMeta")) {
        return {
          ok: true,
          json: async () => datastoreMetaItems
        };
      }

      if (urlStr.includes("datastoreGet")) {
        return {
          ok: true,
          json: async () => []
        };
      }

      if (urlStr.includes("feed.json")) {
        return {
          ok: true,
          json: async () => []
        };
      }

      if (urlStr.includes("v3-cinemeta.strem.io")) {
        return {
          ok: true,
          json: async () => ({
            meta: {
              name: "Test Movie",
              type: "movie",
              genre: ["Action"],
              director: ["Test Director"],
              releaseInfo: "2022"
            }
          })
        };
      }

      if (urlStr.includes("omdbapi.com")) {
        return {
          ok: true,
          json: async () => ({ Response: "True", Genre: "Action" })
        };
      }

      return {
        ok: false,
        json: async () => null
      };
    }) as any;

    const storageGetMock = vi.fn().mockResolvedValue({
      library: [],
      metadata_cache: {},
      omdb_api_key: "test_omdb_key"
    });
    const storageSetMock = vi.fn().mockResolvedValue(undefined);

    (chrome.storage.local.get as any) = storageGetMock;
    (chrome.storage.local.set as any) = storageSetMock;
    (chrome.runtime.sendMessage as any) = vi.fn().mockResolvedValue({});

    await runSyncPipeline();

    // Verify storage.get call count
    // Prior to optimization, storage.get is called 1 + 10 = 11 times.
    // After optimization, storage.get should be called only 1 time for the whole pipeline!
    console.log(`[BENCHMARK] chrome.storage.local.get call count for ${itemsCount} items: ${storageGetMock.mock.calls.length}`);
    expect(storageGetMock).toHaveBeenCalledTimes(1);
    expect(storageGetMock.mock.calls[0][0]).toContain("omdb_api_key");
  });
});
