import { describe, expect, it, vi, beforeEach } from "vitest";
import { needsRepair, getAuthKey } from "./index";
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

describe("getAuthKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return authKey from chrome.storage.local if available", async () => {
    (chrome.storage.local.get as any).mockImplementation((keys: any, cb?: any) => {
      const data = { stremio_auth_key: "stored-key-123" };
      if (typeof cb === "function") cb(data);
      return Promise.resolve(data);
    });

    const key = await getAuthKey();
    expect(key).toBe("stored-key-123");
  });

  it("should request profile via custom event bridge if not in chrome.storage.local", async () => {
    (chrome.storage.local.get as any).mockImplementation((keys: any, cb?: any) => {
      const data = {};
      if (typeof cb === "function") cb(data);
      return Promise.resolve(data);
    });

    const listenPromise = getAuthKey();

    // Simulate event bridge response
    window.dispatchEvent(
      new CustomEvent("STREMIO_PROFILE_EXTRACTED", {
        detail: { authKey: "bridge-key-789" }
      })
    );

    const key = await listenPromise;
    expect(key).toBe("bridge-key-789");
  });
});
