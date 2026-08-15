import { describe, expect, it, vi } from "vitest";
import { processSyncPipeline, SyncPipelineInput, SyncStats } from "./sync";

vi.mock("../analytics/stats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../analytics/stats")>();
  return {
    ...actual,
    computeAnalytics: vi.fn().mockReturnValue({ dummyAnalytics: true })
  };
});

describe("processSyncPipeline", () => {
  it("should process an item with available metadata correctly", async () => {
    const datastoreMap = new Map<string, number>();
    datastoreMap.set("tt1234567", 1000);

    const idTypeMap = new Map<string, "movie" | "series">();
    idTypeMap.set("tt1234567", "movie");

    const datastoreGetMap = new Map<string, any>();
    datastoreGetMap.set("tt1234567", {
      name: "Test Movie",
      type: "movie"
    });

    const mockFetchEnrichedMetadata = vi.fn().mockResolvedValue({
      title: "Test Movie",
      type: "movie",
      genres: ["Action"],
      director: "John Doe",
      releaseYear: "2020",
      poster: "poster.jpg",
      imdbRating: "8.0",
      actors: ["Actor A"],
      plot: "A plot",
      runtime: "120 min"
    });

    const input: SyncPipelineInput = {
      datastoreMap,
      idTypeMap,
      datastoreGetMap,
      existingLibrary: [],
      metadataCache: {},
      fetchEnrichedMetadata: mockFetchEnrichedMetadata
    };

    const result = await processSyncPipeline(input);

    expect(result.mergedLibrary).toHaveLength(1);
    expect(result.mergedLibrary[0].imdbId).toBe("tt1234567");
    expect(result.mergedLibrary[0].title).toBe("Test Movie");
    expect(result.mergedLibrary[0].genres).toEqual(["Action"]);
    expect(result.mergedLibrary[0].firstWatched).toBe(1000);
    expect(result.mergedLibrary[0].lastWatched).toBe(1000);
    expect(result.itemsToFetchCount).toBe(1);
    expect(result.cacheHitsCount).toBe(0);
    expect(result.analytics).toEqual({ dummyAnalytics: true });

    // Check cache updated
    expect(result.updatedMetadataCache["tt1234567"]).toBeDefined();
    expect(result.updatedMetadataCache["tt1234567"].meta.title).toBe("Test Movie");
  });

  it("should use cache if available and valid", async () => {
    const datastoreMap = new Map<string, number>();
    datastoreMap.set("tt1234567", 1000);

    const idTypeMap = new Map<string, "movie" | "series">();
    idTypeMap.set("tt1234567", "movie");

    const datastoreGetMap = new Map<string, any>();

    const validCacheMeta = {
      title: "Cached Movie",
      type: "movie",
      genres: ["Drama"],
      director: "Jane Doe",
      releaseYear: "2021"
    };

    const mockFetchEnrichedMetadata = vi.fn().mockResolvedValue(null);

    const input: SyncPipelineInput = {
      datastoreMap,
      idTypeMap,
      datastoreGetMap,
      existingLibrary: [],
      metadataCache: {
        "tt1234567": {
          timestamp: Date.now() - 1000, // Valid timestamp
          meta: validCacheMeta
        }
      },
      fetchEnrichedMetadata: mockFetchEnrichedMetadata
    };

    const result = await processSyncPipeline(input);

    expect(mockFetchEnrichedMetadata).not.toHaveBeenCalled();
    expect(result.cacheHitsCount).toBe(1);
    expect(result.mergedLibrary[0].title).toBe("Cached Movie");
    expect(result.mergedLibrary[0].genres).toEqual(["Drama"]);
  });

  it("should merge with existing library correctly", async () => {
    const datastoreMap = new Map<string, number>();
    datastoreMap.set("tt1234567", 2000); // Newer timestamp

    const idTypeMap = new Map<string, "movie" | "series">();
    idTypeMap.set("tt1234567", "movie");

    const datastoreGetMap = new Map<string, any>();

    const existingItem = {
      imdbId: "tt1234567",
      title: "Old Title",
      type: "movie",
      firstWatched: 1000,
      lastWatched: 1500,
      genres: ["Action"],
      director: "John",
      releaseYear: "2020" // No repair needed
    };

    const mockFetchEnrichedMetadata = vi.fn();

    const input: SyncPipelineInput = {
      datastoreMap,
      idTypeMap,
      datastoreGetMap,
      existingLibrary: [existingItem],
      metadataCache: {},
      fetchEnrichedMetadata: mockFetchEnrichedMetadata
    };

    const result = await processSyncPipeline(input);

    expect(mockFetchEnrichedMetadata).not.toHaveBeenCalled(); // existing doesn't need repair
    expect(result.itemsToFetchCount).toBe(0);
    expect(result.mergedLibrary[0].firstWatched).toBe(1000); // Keeps oldest
    expect(result.mergedLibrary[0].lastWatched).toBe(2000); // Updates to newest
  });
});
