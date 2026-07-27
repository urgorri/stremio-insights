import { create } from "zustand";
import { PlaybackEvent } from "../types";
import { AnalyticsSummary, computeAnalytics } from "../analytics/stats";

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

      if (typeof chrome === "undefined" || !chrome.tabs) {
        set({ syncLoading: false, syncError: "Extension context not found" });
        reject(new Error("Extension context not found"));
        return;
      }

      chrome.tabs.query({ url: "https://web.stremio.com/*" }, (stremioTabs) => {
        if (stremioTabs && stremioTabs.length > 0) {
          const targetTab = stremioTabs.find(tab => tab.active) || stremioTabs[0];
          if (targetTab.id) {
            chrome.tabs.sendMessage(targetTab.id, { type: "FORCE_RESCAN" }, async (response) => {
              set({ syncLoading: false });
              if (chrome.runtime.lastError) {
                set({ syncError: "Could not communicate with Stremio tab." });
                reject(new Error("Communication failed"));
              } else if (response && response.success) {
                await get().fetchData();
                resolve(1);
              } else {
                set({ syncError: "Sync did not return success status." });
                reject(new Error("Sync failed"));
              }
            });
          } else {
            set({ syncLoading: false, syncError: "Stremio tab could not be identified." });
            reject(new Error("Stremio tab could not be identified."));
          }
        } else {
          set({ syncLoading: false, syncError: "No Stremio tab is currently open." });
          reject(new Error("No open Stremio tab found."));
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
        if (String(event.year) !== filters.year) {
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
