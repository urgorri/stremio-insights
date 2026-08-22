import { describe, expect, it } from "vitest";
import { METADATA_CACHE_TTL_MS } from "./constants";

describe("constants", () => {
  it("should define METADATA_CACHE_TTL_MS as 24 hours in milliseconds", () => {
    expect(METADATA_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(METADATA_CACHE_TTL_MS).toBe(86400000);
  });
});
