import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { useInsightsStore } from "./useInsightsStore";
import { PlaybackEvent } from "../types";
import { computeAnalytics } from "../analytics/stats";

// Helper to reset Zustand store between tests
const initialStoreState = useInsightsStore.getState();

describe("useInsightsStore", () => {
  beforeEach(() => {
    useInsightsStore.setState(initialStoreState, true);
    vi.clearAllMocks();

    // Reset window.runSyncPipeline
    if (typeof window !== "undefined") {
      delete (window as any).runSyncPipeline;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial State", () => {
    it("should have correct default state", () => {
      const state = useInsightsStore.getState();
      expect(state.playbackEvents).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.searchQuery).toBe("");
      expect(state.filters).toEqual({ type: "all", genre: "", year: "" });
      expect(state.syncLoading).toBe(false);
      expect(state.syncError).toBeNull();
    });
  });

  describe("fetchData", () => {
    it("should fetch library and analytics from chrome.storage.local", async () => {
      const mockLibrary: PlaybackEvent[] = [
        { imdb_id: "tt123", title: "Test Movie", type: "movie", year: 2024, duration: 100 } as PlaybackEvent
      ];
      const mockAnalytics = computeAnalytics(mockLibrary);

      // Setup chrome.storage mock
      const getMock = vi.fn((keys, callback) => {
        callback({ library: mockLibrary, analytics: mockAnalytics });
      });
      global.chrome.storage.local.get = getMock as any;

      const store = useInsightsStore.getState();
      await store.fetchData();

      const updatedState = useInsightsStore.getState();
      expect(getMock).toHaveBeenCalledWith(["library", "analytics"], expect.any(Function));
      expect(updatedState.playbackEvents).toEqual(mockLibrary);
      expect(updatedState.stats).toEqual(mockAnalytics);
    });

    it("should handle empty storage gracefully", async () => {
      // Setup chrome.storage mock to return empty
      const getMock = vi.fn((keys, callback) => {
        callback({});
      });
      global.chrome.storage.local.get = getMock as any;

      const store = useInsightsStore.getState();
      await store.fetchData();

      const updatedState = useInsightsStore.getState();
      expect(updatedState.playbackEvents).toEqual([]);
      expect(updatedState.stats).not.toBeNull(); // It computes empty stats
    });

    it("should use empty stub data if chrome context is missing", async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined as any;

      const store = useInsightsStore.getState();
      await store.fetchData();

      const updatedState = useInsightsStore.getState();
      expect(updatedState.playbackEvents).toEqual([]);
      expect(updatedState.stats).not.toBeNull();

      global.chrome = originalChrome;
    });
  });

  describe("performSync", () => {
    it("should sync via background service worker successfully", async () => {
      const sendMessageMock = vi.fn((message, callback) => {
        if (message.type === "START_SYNC") {
          callback({ success: true });
        }
      });
      global.chrome.runtime.sendMessage = sendMessageMock as any;
      global.chrome.runtime.lastError = undefined;

      // Mock fetchData since performSync calls it
      const fetchDataSpy = vi.spyOn(useInsightsStore.getState(), "fetchData").mockResolvedValue();

      const store = useInsightsStore.getState();
      const result = await store.performSync("test_auth_key");

      expect(sendMessageMock).toHaveBeenCalledWith({ type: "START_SYNC" }, expect.any(Function));
      expect(result).toBe(1);
      expect(useInsightsStore.getState().syncLoading).toBe(false);
      expect(useInsightsStore.getState().syncError).toBeNull();
      expect(fetchDataSpy).toHaveBeenCalled();
    });

    it("should handle background service worker sync failure", async () => {
      const sendMessageMock = vi.fn((message, callback) => {
        if (message.type === "START_SYNC") {
          callback({ success: false, error: "Test sync error" });
        }
      });
      global.chrome.runtime.sendMessage = sendMessageMock as any;
      global.chrome.runtime.lastError = undefined;

      const store = useInsightsStore.getState();
      await expect(store.performSync("test_auth_key")).rejects.toThrow("Test sync error");

      expect(useInsightsStore.getState().syncLoading).toBe(false);
      expect(useInsightsStore.getState().syncError).toBe("Test sync error");
    });

    it("should handle background service worker runtime error", async () => {
      const sendMessageMock = vi.fn((message, callback) => {
        if (message.type === "START_SYNC") {
          global.chrome.runtime.lastError = { message: "Runtime error" };
          callback();
        }
      });
      global.chrome.runtime.sendMessage = sendMessageMock as any;

      const store = useInsightsStore.getState();
      await expect(store.performSync("test_auth_key")).rejects.toThrow("Runtime error");

      expect(useInsightsStore.getState().syncLoading).toBe(false);
      expect(useInsightsStore.getState().syncError).toBe("Runtime error");

      global.chrome.runtime.lastError = undefined;
    });

    it("should use window.runSyncPipeline if available (direct call fallback)", async () => {
      const runSyncPipelineMock = vi.fn().mockResolvedValue(undefined);
      (window as any).runSyncPipeline = runSyncPipelineMock;

      const fetchDataSpy = vi.spyOn(useInsightsStore.getState(), "fetchData").mockResolvedValue();

      const store = useInsightsStore.getState();
      const result = await store.performSync("test_auth_key");

      expect(runSyncPipelineMock).toHaveBeenCalled();
      expect(result).toBe(1);
      expect(fetchDataSpy).toHaveBeenCalled();
      expect(useInsightsStore.getState().syncLoading).toBe(false);
      expect(useInsightsStore.getState().syncError).toBeNull();
    });

    it("should handle window.runSyncPipeline failure", async () => {
      const runSyncPipelineMock = vi.fn().mockRejectedValue(new Error("Direct sync failed"));
      (window as any).runSyncPipeline = runSyncPipelineMock;

      const store = useInsightsStore.getState();
      await expect(store.performSync("test_auth_key")).rejects.toThrow("Direct sync failed");

      expect(useInsightsStore.getState().syncLoading).toBe(false);
      expect(useInsightsStore.getState().syncError).toBe("Direct sync failed");
    });

    it("should fail if service worker is unavailable", async () => {
      const originalRuntime = global.chrome.runtime;
      global.chrome.runtime = undefined as any;

      const store = useInsightsStore.getState();
      await expect(store.performSync("test_auth_key")).rejects.toThrow("Service worker unavailable.");

      expect(useInsightsStore.getState().syncLoading).toBe(false);
      expect(useInsightsStore.getState().syncError).toBe("Service worker unavailable.");

      global.chrome.runtime = originalRuntime;
    });
  });

  describe("clearHistory", () => {
    it("should clear history from chrome.storage.local and fetch updated data", async () => {
      const removeMock = vi.fn((keys, callback) => callback());
      global.chrome.storage.local.remove = removeMock as any;

      const fetchDataSpy = vi.spyOn(useInsightsStore.getState(), "fetchData").mockResolvedValue();

      const store = useInsightsStore.getState();
      await store.clearHistory();

      expect(removeMock).toHaveBeenCalledWith(["library", "analytics", "lastSync"], expect.any(Function));
      expect(fetchDataSpy).toHaveBeenCalled();
    });

    it("should do nothing if chrome context is missing", async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined as any;

      const store = useInsightsStore.getState();
      await store.clearHistory();

      global.chrome = originalChrome;
    });
  });

  describe("Search and Filters", () => {
    const mockLibrary: PlaybackEvent[] = [
      { imdb_id: "tt1", title: "Inception", type: "movie", genres: ["Action", "Sci-Fi"], year: 2010 } as PlaybackEvent,
      { imdb_id: "tt2", title: "Interstellar", type: "movie", genres: ["Sci-Fi", "Drama"], year: 2014 } as PlaybackEvent,
      { imdb_id: "tt3", title: "Breaking Bad", type: "series", genres: ["Crime", "Drama"], year: 2008 } as PlaybackEvent
    ];

    beforeEach(() => {
      useInsightsStore.setState({ playbackEvents: mockLibrary });
    });

    it("should filter by type", () => {
      const store = useInsightsStore.getState();
      store.setFilters({ type: "movie" });

      const filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toBe("Inception");
      expect(filtered[1].title).toBe("Interstellar");

      store.setFilters({ type: "series" });
      const filteredSeries = useInsightsStore.getState().getFilteredEvents();
      expect(filteredSeries).toHaveLength(1);
      expect(filteredSeries[0].title).toBe("Breaking Bad");
    });

    it("should filter by genre", () => {
      const store = useInsightsStore.getState();
      store.setFilters({ genre: "Sci-Fi" });

      const filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(2);
      expect(filtered.map(f => f.title)).toContain("Inception");
      expect(filtered.map(f => f.title)).toContain("Interstellar");
    });

    it("should filter by year", () => {
      const store = useInsightsStore.getState();
      store.setFilters({ year: "2014" });

      const filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Interstellar");
    });

    it("should handle search queries (title, imdb_id, genre, year)", () => {
      const store = useInsightsStore.getState();

      // By Title
      store.setSearchQuery("incept");
      let filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Inception");

      // By Genre
      store.setSearchQuery("Crime");
      filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Breaking Bad");

      // By IMDB ID
      store.setSearchQuery("tt2");
      filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Interstellar");

      // By Year
      store.setSearchQuery("2008");
      filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Breaking Bad");
    });

    it("should combine search and filters", () => {
      const store = useInsightsStore.getState();
      store.setFilters({ type: "movie" });
      store.setSearchQuery("Drama");

      const filtered = useInsightsStore.getState().getFilteredEvents();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Interstellar");
    });
  });
});
