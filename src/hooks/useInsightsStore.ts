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

      const logEarlyFailure = (errorMsg: string) => {
        const elapsedTime = Math.round(performance.now() - startTime);
        console.log(`[SYNC] SYNC START\n` +
                    `[SYNC] Sender: Popup\n` +
                    `[SYNC] Target tab id: N/A\n` +
                    `[SYNC] Target URL: N/A\n` +
                    `[SYNC] Message type: FORCE_RESCAN\n` +
                    `[SYNC] Receiver: Content Script\n` +
                    `[SYNC] Response: ${errorMsg}\n` +
                    `[SYNC] Elapsed time: ${elapsedTime}ms\n` +
                    `[SYNC] Result: Failure`);
      };

      if (typeof chrome === "undefined" || !chrome.tabs || !chrome.runtime) {
        const err = new Error("Service worker unavailable.");
        logEarlyFailure(err.message);
        set({ syncLoading: false, syncError: err.message });
        reject(err);
        return;
      }

      // 1. Get the current active/focused tab in current window to validate before messaging
      chrome.tabs.query({ active: true, currentWindow: true }, async (activeTabs) => {
        const activeTab = activeTabs && activeTabs[0];

        // 2. Query for any web.stremio.com tab open in the browser
        chrome.tabs.query({ url: "https://web.stremio.com/*" }, async (stremioTabs) => {
          const stremioTabsCount = stremioTabs ? stremioTabs.length : 0;

          // Check if no Stremio tabs exist at all
          if (stremioTabsCount === 0) {
            const err = new Error("No active Stremio tab found.");
            logEarlyFailure(err.message);
            set({ syncLoading: false, syncError: err.message });
            reject(err);
            return;
          }

          // Check if the current tab is NOT web.stremio.com
          const activeUrl = activeTab?.url || "";
          const isCurrentTabStremio = activeUrl.startsWith("https://web.stremio.com");

          if (!isCurrentTabStremio) {
            const err = new Error("Synchronization aborted because current tab is not web.stremio.com.");
            logEarlyFailure(err.message);
            set({ syncLoading: false, syncError: err.message });
            reject(err);
            return;
          }

          // Prioritize active and non-discarded tabs
          const targetTab = stremioTabs.find(tab => tab.active && !tab.discarded) ||
                            stremioTabs.find(tab => !tab.discarded) ||
                            stremioTabs.find(tab => tab.active) ||
                            stremioTabs[0];

          if (!targetTab || !targetTab.id) {
            const err = new Error("No active Stremio tab found.");
            logEarlyFailure(err.message);
            set({ syncLoading: false, syncError: err.message });
            reject(err);
            return;
          }

          const tabId = targetTab.id;

          const logSyncAttempt = (result: "Success" | "Failure", responseData: any, errorDetail?: string) => {
            const elapsedTime = Math.round(performance.now() - startTime);
            console.log(`[SYNC] SYNC START\n` +
                        `[SYNC] Sender: Popup\n` +
                        `[SYNC] Target tab id: ${tabId}\n` +
                        `[SYNC] Target URL: ${targetTab.url || "https://web.stremio.com/*"}\n` +
                        `[SYNC] Message type: FORCE_RESCAN\n` +
                        `[SYNC] Receiver: Content Script\n` +
                        `[SYNC] Response: ${JSON.stringify(responseData || errorDetail || "None")}\n` +
                        `[SYNC] Elapsed time: ${elapsedTime}ms\n` +
                        `[SYNC] Result: ${result}`);
          };

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

          // Helper to send message with up to 3 retries (500ms delay) and a 5s timeout
          const sendMessageWithRetry = (tId: number, msg: any, retries = 3, delay = 500): Promise<any> => {
            return new Promise((res, rej) => {
              const attempt = (remaining: number) => {
                let resolvedOrRejected = false;

                const timeoutId = setTimeout(() => {
                  if (!resolvedOrRejected) {
                    resolvedOrRejected = true;
                    rej(new Error("Message timed out."));
                  }
                }, 5000); // 5s timeout

                chrome.tabs.sendMessage(tId, msg, (response) => {
                  clearTimeout(timeoutId);
                  if (resolvedOrRejected) return;

                  const err = chrome.runtime.lastError;
                  if (err) {
                    const errMsg = err.message || "";
                    if (remaining > 0) {
                      console.log(`[SYNC] Send message to tab ${tId} failed: ${errMsg}. Retrying in ${delay}ms... (${remaining} retries left)`);
                      setTimeout(() => attempt(remaining - 1), delay);
                    } else {
                      resolvedOrRejected = true;
                      if (errMsg.includes("Could not establish connection") || errMsg.includes("Receiving end does not exist")) {
                        rej(new Error("Content script not injected. Receiver does not exist."));
                      } else {
                        rej(new Error(errMsg || "No message listener registered."));
                      }
                    }
                  } else {
                    resolvedOrRejected = true;
                    res(response);
                  }
                });
              };
              attempt(retries);
            });
          };

          try {
            // If target tab is not active, activate it first so it is focused and can sync reliably
            if (!targetTab.active) {
              console.log(`[SYNC] Activating Stremio tab ${tabId} for sync...`);
              await new Promise<void>((resolveUpdate) => {
                chrome.tabs.update(tabId, { active: true }, () => resolveUpdate());
              });
            }

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

            if (response && typeof response === "object") {
              if (response.success) {
                logSyncAttempt("Success", response);
                await get().fetchData();
                set({ syncLoading: false });
                resolve(1);
              } else {
                const errDetail = response.error || "Invalid response payload.";
                logSyncAttempt("Failure", response, errDetail);
                set({ syncLoading: false, syncError: errDetail });
                reject(new Error(errDetail));
              }
            } else {
              const errDetail = "Invalid response payload.";
              logSyncAttempt("Failure", response, errDetail);
              set({ syncLoading: false, syncError: errDetail });
              reject(new Error(errDetail));
            }
          } catch (err: any) {
            const errMsg = err.message || "Communication failed";
            logSyncAttempt("Failure", null, errMsg);
            set({ syncLoading: false, syncError: errMsg });
            reject(err); // Propagate the original precise error!
          }
        });
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
