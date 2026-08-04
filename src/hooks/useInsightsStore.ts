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

      chrome.tabs.query({ url: "https://web.stremio.com/*" }, async (stremioTabs) => {
        if (stremioTabs && stremioTabs.length > 0) {
          // Prioritize active and non-discarded tabs
          const targetTab = stremioTabs.find(tab => tab.active && !tab.discarded) ||
                            stremioTabs.find(tab => !tab.discarded) ||
                            stremioTabs.find(tab => tab.active) ||
                            stremioTabs[0];

          if (targetTab.id) {
            const tabId = targetTab.id;

            // Helper to wait for the tab to complete loading (5s timeout)
            const waitForTabComplete = (tId: number): Promise<void> => {
              return new Promise<void>((res) => {
                let resolved = false;
                const done = () => {
                  if (!resolved) {
                    resolved = true;
                    chrome.tabs.onUpdated.removeListener(listener);
                    clearTimeout(timeout);
                    res();
                  }
                };
                const timeout = setTimeout(done, 5000);
                const listener = (updatedTabId: number, changeInfo: any) => {
                  if (updatedTabId === tId && changeInfo.status === "complete") {
                    done();
                  }
                };
                chrome.tabs.get(tId, (tab) => {
                  const err = chrome.runtime.lastError;
                  if (err || !tab) {
                    done();
                    return;
                  }
                  if (tab.status === "complete") {
                    done();
                    return;
                  }
                  chrome.tabs.onUpdated.addListener(listener);
                });
              });
            };

            // Helper to send message with up to 3 retries (500ms delay)
            const sendMessageWithRetry = (tId: number, msg: any, retries = 3, delay = 500): Promise<any> => {
              return new Promise((res, rej) => {
                const attempt = (remaining: number) => {
                  chrome.tabs.sendMessage(tId, msg, (response) => {
                    const err = chrome.runtime.lastError;
                    if (err) {
                      if (remaining > 0) {
                        console.log(`[SYNC] Send message to tab ${tId} failed: ${err.message}. Retrying in ${delay}ms... (${remaining} retries left)`);
                        setTimeout(() => attempt(remaining - 1), delay);
                      } else {
                        rej(new Error(err.message || "Communication failed"));
                      }
                    } else {
                      res(response);
                    }
                  });
                };
                attempt(retries);
              });
            };

            try {
              // If tab is discarded, reload it first to wake it up
              if (targetTab.discarded) {
                console.log(`[SYNC] Stremio tab ${tabId} is discarded. Waking it up/reloading...`);
                chrome.tabs.reload(tabId);
                await waitForTabComplete(tabId);
              } else if (targetTab.status === "loading") {
                console.log(`[SYNC] Stremio tab ${tabId} is currently loading. Waiting for it to complete...`);
                await waitForTabComplete(tabId);
              }

              // Send the FORCE_RESCAN message with retry policy
              const response = await sendMessageWithRetry(tabId, { type: "FORCE_RESCAN" });
              set({ syncLoading: false });
              if (response && response.success) {
                await get().fetchData();
                resolve(1);
              } else {
                set({ syncError: "Sync did not return success status." });
                reject(new Error("Sync failed"));
              }
            } catch (err: any) {
              set({ syncLoading: false, syncError: err.message || "Could not communicate with Stremio tab." });
              reject(new Error("Communication failed"));
            }
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
