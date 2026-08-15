import { describe, expect, it } from "vitest";
import { needsRepair } from "./sync";

describe("needsRepair", () => {
  it("should return true if item is falsy", () => {
    expect(needsRepair(null)).toBe(true);
    expect(needsRepair(undefined)).toBe(true);
  });

  it("should return true if item type does not match correctType", () => {
    const item = { type: "movie", genres: ["Action"], director: "John", releaseYear: "2020" };
    expect(needsRepair(item, "series")).toBe(true);
  });

  it("should return false for valid movie", () => {
    const item = { type: "movie", genres: ["Action"], director: "John Doe", releaseYear: "2020" };
    expect(needsRepair(item)).toBe(false);
  });

  it("should return false for valid series (director can be missing)", () => {
    const item = { type: "series", genres: ["Drama"], releaseYear: "2021" };
    expect(needsRepair(item)).toBe(false);
  });

  describe("genres validation", () => {
    it("should return true if genres array contains only 'Historical'", () => {
      const item = { type: "movie", genres: ["Historical"], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return false if genres array contains 'Historical' and others", () => {
      const item = { type: "movie", genres: ["Historical", "Action"], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(false);
    });

    it("should return true if genres is missing", () => {
      const item = { type: "movie", director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if genres is empty array", () => {
      const item = { type: "movie", genres: [], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if genres is not an array", () => {
      const item = { type: "movie", genres: "Action", director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });
  });

  describe("director validation", () => {
    it("should return true for movie if director is null", () => {
      const item = { type: "movie", genres: ["Action"], director: null, releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true for movie if director is undefined", () => {
      const item = { type: "movie", genres: ["Action"], releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return false for series if director is null", () => {
      const item = { type: "series", genres: ["Action"], director: null, releaseYear: "2020" };
      expect(needsRepair(item)).toBe(false);
    });
  });

  describe("releaseYear validation", () => {
    it("should return true if releaseYear is missing", () => {
      const item = { type: "movie", genres: ["Action"], director: "John" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if releaseYear is 'Unknown'", () => {
      const item = { type: "movie", genres: ["Action"], director: "John", releaseYear: "Unknown" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if releaseYear is malformed (not 4 digits)", () => {
      const cases = ["20", "20204", "abcd", "20-20", "202X"];
      cases.forEach(year => {
        const item = { type: "movie", genres: ["Action"], director: "John", releaseYear: year };
        expect(needsRepair(item)).toBe(true);
      });
    });
  });
});
