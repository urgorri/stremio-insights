import { describe, expect, it } from "vitest";
import { parsePlayerHash } from "./hash";

describe("Player Hash Parser", () => {
  it("should parse a movie player hash correctly", () => {
    const hash = "#/player/local/movie/tt1234567/tt1234567";
    const details = parsePlayerHash(hash);
    expect(details).toEqual({
      imdb_id: "tt1234567",
      parent_id: "tt1234567",
      type: "movie",
      season: undefined,
      episode: undefined
    });
  });

  it("should parse a series player hash with season and episode correctly", () => {
    const hash = "#/player/local/series/tt7654321/tt7654321:2:5";
    const details = parsePlayerHash(hash);
    expect(details).toEqual({
      imdb_id: "tt7654321:2:5",
      parent_id: "tt7654321",
      type: "series",
      season: 2,
      episode: 5
    });
  });

  it("should return null for non-player hash inputs", () => {
    expect(parsePlayerHash("#/discover")).toBeNull();
    expect(parsePlayerHash("#/detail/movie/tt1234567")).toBeNull();
  });
});
