import { create } from "zustand";
import { PlaybackEvent, WatchStats } from "../types";
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
      // Fetch playback events
      chrome.runtime.sendMessage({ type: "GET_PLAYBACK_EVENTS" }, (response) => {
        const events = response && response.success ? response.events : [];

        // Fetch stats
        chrome.runtime.sendMessage({ type: "GET_STATS" }, (statsResponse) => {
          const stats = statsResponse && statsResponse.success ? statsResponse.stats : null;

          set({
            playbackEvents: events,
            stats: stats || computeAnalytics(events)
          });
          resolve();
        });
      });
    });
  },

  performSync: async (authKey: string) => {
    set({ syncLoading: true, syncError: null });
    return new Promise<number>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "STREMIO_SYNC_REQUEST", payload: { authKey } },
        async (response) => {
          set({ syncLoading: false });
          if (response && response.success) {
            await get().fetchData();
            resolve(response.importedCount);
          } else {
            const err = response ? response.error : "Sync failed";
            set({ syncError: err });
            reject(new Error(err));
          }
        }
      );
    });
  },

  clearHistory: async () => {
    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, async () => {
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
        const matchesImdb = event.imdb_id.toLowerCase().includes(q);
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
