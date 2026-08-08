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

  it("should return null for empty or invalid hash values", () => {
    expect(parsePlayerHash("")).toBeNull();
    // @ts-expect-error Testing invalid input
    expect(parsePlayerHash(null)).toBeNull();
    // @ts-expect-error Testing invalid input
    expect(parsePlayerHash(undefined)).toBeNull();
  });

  it("should return null if the hash has fewer than 6 parts", () => {
    expect(parsePlayerHash("#/player/local/movie")).toBeNull();
    expect(parsePlayerHash("#/player/local/movie/tt1234567")).toBeNull();
  });

  it("should return null for unsupported types", () => {
    expect(parsePlayerHash("#/player/local/channel/tt1234567/tt1234567")).toBeNull();
    expect(parsePlayerHash("#/player/local/other/tt1234567/tt1234567")).toBeNull();
  });

  it("should parse series with missing colons in video_id without setting season/episode", () => {
    const hash = "#/player/local/series/tt7654321/tt7654321";
    const details = parsePlayerHash(hash);
    expect(details).toEqual({
      imdb_id: "tt7654321",
      parent_id: "tt7654321",
      type: "series",
      season: undefined,
      episode: undefined
    });
  });

  it("should parse series with insufficient colon-separated parts in video_id without setting season/episode", () => {
    const hash = "#/player/local/series/tt7654321/tt7654321:2";
    const details = parsePlayerHash(hash);
    expect(details).toEqual({
      imdb_id: "tt7654321:2",
      parent_id: "tt7654321",
      type: "series",
      season: undefined,
      episode: undefined
    });
  });
});
