import { create } from "zustand";
import { PlaybackEvent } from "../types";
import { AnalyticsSummary, computeAnalytics } from "../analytics/stats";
import { normalizeReleaseYear } from "../utils/date";

interface InsightsFilters {
  type: "all" | "movie" | "series";
  genre: string;
  year: string;
}

interface InsightsState {
  playbackEvents: PlaybackEvent[];
  stats: AnalyticsSummary | null;
  searchQuery: string;
  filters: InsightsFilters;
  syncLoading: boolean;
  syncError: string | null;

  // Actions
  fetchData: () => Promise<void>;
  performSync: (authKey: string) => Promise<number>;
  clearHistory: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<InsightsFilters>) => void;
  getFilteredEvents: () => PlaybackEvent[];
}

export const useInsightsStore = create<InsightsState>((set, get) => ({
  playbackEvents: [],
  stats: null,
  searchQuery: "",
  filters: {
    type: "all",
    genre: "",
    year: ""
  },
  syncLoading: false,
  syncError: null,

  fetchData: async () => {
    return new Promise<void>((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        console.warn("[Stremio Insights] Chrome Extension context not found. Using empty stub data.");
        set({
          playbackEvents: [],
          stats: computeAnalytics([])
        });
        resolve();
        return;
      }

      chrome.storage.local.get(["library", "analytics"], (res) => {
        const library = Array.isArray(res.library) ? res.library : [];
        const stats = res.analytics || computeAnalytics(library);
        set({
          playbackEvents: library,
          stats
        });
        resolve();
      });
    });
  },

  performSync: async (authKey: string) => {
    set({ syncLoading: true, syncError: null });
    const startTime = performance.now();

    return new Promise<number>(async (resolve, reject) => {
      // Direct call fallback for Content Script context (Sidebar UI)
      if (typeof window !== "undefined" && (window as any).runSyncPipeline) {
        try {
          await (window as any).runSyncPipeline();
          await get().fetchData();
          set({ syncLoading: false });
          resolve(1);
        } catch (err: any) {
          set({ syncLoading: false, syncError: err.message || "Sync failed" });
          reject(err);
        }
        return;
      }

      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        const err = new Error("Service worker unavailable.");
        set({ syncLoading: false, syncError: err.message });
        reject(err);
        return;
      }

      // Delegate programmatic initialization and rescan pipeline completely to Background SW
      chrome.runtime.sendMessage({ type: "START_SYNC" }, async (response) => {
        const err = chrome.runtime.lastError;
        const elapsedTime = Math.round(performance.now() - startTime);

        if (err) {
          console.error("[SYNC] START_SYNC background request failed:", err.message);
          set({ syncLoading: false, syncError: err.message });
          reject(new Error(err.message));
          return;
        }

        if (response && response.success) {
          console.log(`[SYNC] START_SYNC completed successfully in ${elapsedTime}ms`);
          await get().fetchData();
          set({ syncLoading: false });
          resolve(1);
        } else {
          const errorMsg = response?.error || "Sync execution failed.";
          console.error(`[SYNC] START_SYNC failed in ${elapsedTime}ms:`, errorMsg);
          set({ syncLoading: false, syncError: errorMsg });
          reject(new Error(errorMsg));
        }
      });
    });
  },

  clearHistory: async () => {
    return new Promise<void>((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      chrome.storage.local.remove(["library", "analytics", "lastSync"], async () => {
        await get().fetchData();
        resolve();
      });
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setFilters: (newFilters: Partial<InsightsFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  getFilteredEvents: () => {
    const { playbackEvents, searchQuery, filters } = get();

    return playbackEvents.filter((event) => {
      // 1. Type filter
      if (filters.type !== "all" && event.type !== filters.type) {
        return false;
      }

      // 2. Genre filter
      if (filters.genre) {
        const hasGenre = event.genres?.some(
          (g) => g.toLowerCase() === filters.genre.toLowerCase()
        );
        if (!hasGenre) return false;
      }

      // 3. Year filter
      if (filters.year) {
        const eventNormYear = normalizeReleaseYear(event.releaseYear || event.year);
        if (eventNormYear !== filters.year) {
          return false;
        }
      }

      // 4. Free-text search query (Title, IMDb ID, Genre, Year)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = event.title.toLowerCase().includes(q);
        const matchesImdb = (event.imdbId || event.imdb_id || "").toLowerCase().includes(q);
        const matchesGenre = event.genres?.some((g) => g.toLowerCase().includes(q)) ?? false;
        const matchesYear = event.year ? String(event.year).includes(q) : false;

        if (!matchesTitle && !matchesImdb && !matchesGenre && !matchesYear) {
          return false;
        }
      }

      return true;
    });
  }
}));
