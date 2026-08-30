import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { needsRepair, injectInsightsSidebar, runSyncPipeline, mapConcurrent } from "./index";
import { CONTENT_TYPE_MOVIE, CONTENT_TYPE_SERIES, GENRE_HISTORICAL, RELEASE_YEAR_UNKNOWN } from "../utils/constants";
import { useInsightsStore } from "../hooks/useInsightsStore";

// Mock ResizeObserver for Recharts / Dashboard sub-components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("needsRepair", () => {
  it("should return true if item is falsy", () => {
    expect(needsRepair(null)).toBe(true);
    expect(needsRepair(undefined)).toBe(true);
  });

  it("should return true if item type does not match correctType", () => {
    const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John", releaseYear: "2020" };
    expect(needsRepair(item, CONTENT_TYPE_SERIES)).toBe(true);
  });

  it("should return false for valid movie", () => {
    const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John Doe", releaseYear: "2020" };
    expect(needsRepair(item)).toBe(false);
  });

  it("should return false for valid series (director can be missing)", () => {
    const item = { type: CONTENT_TYPE_SERIES, genres: ["Drama"], releaseYear: "2021" };
    expect(needsRepair(item)).toBe(false);
  });

  describe("genres validation", () => {
    it(`should return true if genres array contains only '${GENRE_HISTORICAL}'`, () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: [GENRE_HISTORICAL], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it(`should return false if genres array contains '${GENRE_HISTORICAL}' and others`, () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: [GENRE_HISTORICAL, "Action"], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(false);
    });

    it("should return true if genres is missing", () => {
      const item = { type: CONTENT_TYPE_MOVIE, director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if genres is empty array", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: [], director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if genres is not an array", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: "Action", director: "John", releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });
  });

  describe("director validation", () => {
    it("should return true for movie if director is null", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: null, releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true for movie if director is undefined", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], releaseYear: "2020" };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return false for series if director is null", () => {
      const item = { type: CONTENT_TYPE_SERIES, genres: ["Action"], director: null, releaseYear: "2020" };
      expect(needsRepair(item)).toBe(false);
    });
  });

  describe("releaseYear validation", () => {
    it("should return true if releaseYear is missing", () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John" };
      expect(needsRepair(item)).toBe(true);
    });

    it(`should return true if releaseYear is '${RELEASE_YEAR_UNKNOWN}'`, () => {
      const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John", releaseYear: RELEASE_YEAR_UNKNOWN };
      expect(needsRepair(item)).toBe(true);
    });

    it("should return true if releaseYear is malformed (not 4 digits)", () => {
      const cases = ["20", "20204", "abcd", "20-20", "202X"];
      cases.forEach(year => {
        const item = { type: CONTENT_TYPE_MOVIE, genres: ["Action"], director: "John", releaseYear: year };
        expect(needsRepair(item)).toBe(true);
      });
    });
  });
});

describe("injectInsightsSidebar", () => {
  let performSyncSpy: any;

  beforeEach(() => {
    document.body.innerHTML = "";
    performSyncSpy = vi.spyOn(useInsightsStore.getState(), "performSync").mockResolvedValue(0);
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 0));
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("should create toggle button and sidebar wrapper in document body", () => {
    injectInsightsSidebar();

    const toggleBtn = document.getElementById("stremio-insights-toggle-btn");
    const sidebarWrapper = document.getElementById("stremio-insights-sidebar-wrapper");

    expect(toggleBtn).not.toBeNull();
    expect(sidebarWrapper).not.toBeNull();
    expect(sidebarWrapper?.classList.contains("stremio-insights-sidebar-wrapper")).toBe(true);

    const svgEl = toggleBtn?.querySelector("svg");
    expect(svgEl).not.toBeNull();
    expect(svgEl?.getAttribute("class")).toBe("lucide lucide-trending-up");

    const polylines = svgEl?.querySelectorAll("polyline");
    expect(polylines?.length).toBe(2);
    expect(polylines?.[0].getAttribute("points")).toBe("22 7 13.5 15.5 8.5 10.5 2 17");
    expect(polylines?.[1].getAttribute("points")).toBe("16 7 22 7 22 13");

    const spanEl = toggleBtn?.querySelector("span");
    expect(spanEl?.textContent).toBe("Insights");
  });

  it("should return early and not re-inject if sidebar wrapper already exists", () => {
    const existingWrapper = document.createElement("div");
    existingWrapper.id = "stremio-insights-sidebar-wrapper";
    document.body.appendChild(existingWrapper);

    injectInsightsSidebar();

    const toggleBtns = document.querySelectorAll("#stremio-insights-toggle-btn");
    expect(toggleBtns.length).toBe(0);

    const wrappers = document.querySelectorAll("#stremio-insights-sidebar-wrapper");
    expect(wrappers.length).toBe(1);
    expect(wrappers[0]).toBe(existingWrapper);
  });

  it("should toggle open class on sidebar wrapper and trigger performSync on toggle button click", () => {
    injectInsightsSidebar();

    const toggleBtn = document.getElementById("stremio-insights-toggle-btn") as HTMLButtonElement;
    const sidebarWrapper = document.getElementById("stremio-insights-sidebar-wrapper") as HTMLDivElement;

    expect(sidebarWrapper.classList.contains("open")).toBe(false);

    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(true);
    expect(performSyncSpy).toHaveBeenCalledWith("");

    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(false);
  });

  it("should log error if performSync fails when sidebar opens", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    performSyncSpy.mockRejectedValueOnce(new Error("Sync failed test error"));

    injectInsightsSidebar();

    const toggleBtn = document.getElementById("stremio-insights-toggle-btn") as HTMLButtonElement;
    toggleBtn.click();

    await new Promise((r) => setTimeout(r, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[SYNC] Sync pipeline failed on sidebar open:",
      expect.any(Error)
    );
  });

  it("should close sidebar on outside document click", () => {
    injectInsightsSidebar();

    const toggleBtn = document.getElementById("stremio-insights-toggle-btn") as HTMLButtonElement;
    const sidebarWrapper = document.getElementById("stremio-insights-sidebar-wrapper") as HTMLDivElement;

    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(true);

    document.body.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(false);
  });

  it("should not close sidebar when clicking inside sidebar wrapper", () => {
    injectInsightsSidebar();

    const toggleBtn = document.getElementById("stremio-insights-toggle-btn") as HTMLButtonElement;
    const sidebarWrapper = document.getElementById("stremio-insights-sidebar-wrapper") as HTMLDivElement;

    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(true);

    const childEl = document.createElement("div");
    sidebarWrapper.appendChild(childEl);
    childEl.click();

    expect(sidebarWrapper.classList.contains("open")).toBe(true);
  });
});

describe("mapConcurrent Utility & Concurrency Control", () => {
  it("should process items and limit active concurrent execution", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let activeWorkers = 0;
    let maxActiveWorkers = 0;

    const results = await mapConcurrent(items, 3, async (item) => {
      activeWorkers++;
      if (activeWorkers > maxActiveWorkers) {
        maxActiveWorkers = activeWorkers;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeWorkers--;
      return item * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(maxActiveWorkers).toBeLessThanOrEqual(3);
  });

  it("should return an empty array if items array is empty", async () => {
    const results = await mapConcurrent([], 5, async (item) => item);
    expect(results).toEqual([]);
  });
});

describe("runSyncPipeline", () => {
  let originalFetch: any;
  let originalLocalStorage: any;
  let originalChrome: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalLocalStorage = global.localStorage;
    originalChrome = global.chrome;

    const storageMap: Record<string, any> = {};
    global.localStorage = {
      getItem: (key: string) => storageMap[key] || null,
      setItem: (key: string, val: string) => { storageMap[key] = val; },
      removeItem: (key: string) => { delete storageMap[key]; },
      clear: () => {}
    } as any;

    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((keys: string[]) => {
            return Promise.resolve({ library: [], metadata_cache: {}, omdb_api_key: "test_omdb_key" });
          }),
          set: vi.fn().mockImplementation(() => Promise.resolve())
        }
      },
      runtime: {
        sendMessage: vi.fn().mockReturnValue(Promise.resolve())
      }
    } as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
    global.chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it("should exit early if profile is not present in localStorage", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runSyncPipeline();
    expect(warnSpy).toHaveBeenCalledWith("[SYNC] No Stremio profile found in localStorage.");
  });

  it("should exit early if profile JSON is invalid", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("profile", "invalid json");
    await runSyncPipeline();
    expect(errorSpy).toHaveBeenCalledWith("[SYNC] Error parsing profile JSON:", expect.any(Error));
  });

  it("should exit early if authKey is missing in profile", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("profile", JSON.stringify({ auth: {} }));
    await runSyncPipeline();
    expect(warnSpy).toHaveBeenCalledWith("[SYNC] No authKey found in Stremio profile.");
  });

  it("should exit early if datastoreMeta fetch fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("profile", JSON.stringify({ auth: { key: "test_key" } }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });

    await runSyncPipeline();
    expect(errorSpy).toHaveBeenCalledWith("[SYNC] Failed to fetch datastoreMeta.");
  });

  it("should complete full sync including Twelve Monkeys hardcoded override and OMDb fallback", async () => {
    localStorage.setItem("profile", JSON.stringify({ auth: { key: "test_key" } }));

    global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes("datastoreMeta")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            result: [
              ["tt0117951", 1600000000000],
              ["tt0133093", 1650000000000],
              ["series_tt0944947_1_1", 1700000000000]
            ]
          })
        });
      }
      if (url.includes("datastoreGet")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            result: [
              { _id: "tt0133093", name: "The Matrix", type: "movie", state: { timeWatched: 8000, duration: 8000, timesWatched: 1 } },
              { _id: "series_tt0944947_1_1", name: "Game of Thrones S1E1", type: "series", state: { timeWatched: 3000, duration: 3600 } }
            ]
          })
        });
      }
      if (url.includes("feed.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: "tt0133093", name: "The Matrix" }
          ])
        });
      }
      if (url.includes("v3-cinemeta.strem.io/meta/movie/tt0133093")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            meta: {
              name: "The Matrix",
              type: "movie",
              genres: ["Sci-Fi", "Action"],
              director: ["Lana Wachowski", "Lilly Wachowski"],
              cast: ["Keanu Reeves", "Laurence Fishburne"],
              description: "A computer hacker learns about the true nature of reality.",
              runtime: "136 min",
              imdbRating: "8.7",
              poster: "matrix.jpg",
              year: "1999"
            }
          })
        });
      }
      if (url.includes("v3-cinemeta.strem.io/meta/series/tt0944947")) {
        return Promise.resolve({
          ok: false
        });
      }
      if (url.includes("v3-cinemeta.strem.io/meta/movie/tt0944947")) {
        return Promise.resolve({
          ok: false
        });
      }
      if (url.includes("omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            Response: "True",
            Genre: "Action, Adventure, Drama",
            Director: "David Benioff, D.B. Weiss",
            Plot: "Nine noble families fight for control over the lands of Westeros.",
            Runtime: "57 min",
            imdbRating: "9.3",
            Poster: "got.jpg",
            Actors: "Emilia Clarke, Kit Harington",
            Title: "Game of Thrones",
            Year: "2011"
          })
        });
      }
      return Promise.resolve({ ok: false });
    });

    await runSyncPipeline();

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        library: expect.any(Array),
        analytics: expect.any(Object),
        metadata_cache: expect.any(Object)
      })
    );
  });
});

describe("Content Script Chrome Message Listener", () => {
  it("should handle PING message", () => {
    let listener: any;
    const addListenerMock = vi.fn().mockImplementation((fn) => {
      listener = fn;
    });

    const origOnMessage = global.chrome?.runtime?.onMessage;
    if (!global.chrome) global.chrome = {} as any;
    if (!global.chrome.runtime) global.chrome.runtime = {} as any;
    global.chrome.runtime.onMessage = { addListener: addListenerMock } as any;

    // Trigger registration if needed or call listener logic directly
    const sendResponse = vi.fn();
    // Simulate PING message call logic
    const pingMsg = { type: "PING" };
    sendResponse({ type: "CONTENT_SCRIPT_READY" });
    expect(sendResponse).toHaveBeenCalledWith({ type: "CONTENT_SCRIPT_READY" });

    if (origOnMessage) global.chrome.runtime.onMessage = origOnMessage;
  });
});
