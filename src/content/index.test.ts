import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { needsRepair, injectInsightsSidebar } from "./index";
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
    performSyncSpy = vi.spyOn(useInsightsStore.getState(), "performSync").mockResolvedValue(undefined);
  });

  afterEach(() => {
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

    // Verify SVG icon inside toggle button
    const svgEl = toggleBtn?.querySelector("svg");
    expect(svgEl).not.toBeNull();
    expect(svgEl?.getAttribute("class")).toBe("lucide lucide-trending-up");

    const polylines = svgEl?.querySelectorAll("polyline");
    expect(polylines?.length).toBe(2);
    expect(polylines?.[0].getAttribute("points")).toBe("22 7 13.5 15.5 8.5 10.5 2 17");
    expect(polylines?.[1].getAttribute("points")).toBe("16 7 22 7 22 13");

    // Verify span text
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

    // First click: opening
    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(true);
    expect(performSyncSpy).toHaveBeenCalledWith("");

    // Second click: closing
    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(false);
  });

  it("should log error if performSync fails when sidebar opens", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    performSyncSpy.mockRejectedValueOnce(new Error("Sync failed test error"));

    injectInsightsSidebar();

    const toggleBtn = document.getElementById("stremio-insights-toggle-btn") as HTMLButtonElement;
    toggleBtn.click();

    // Allow promise rejection handler to run
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

    // Open sidebar
    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(true);

    // Click outside on document body
    document.body.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(false);
  });

  it("should not close sidebar when clicking inside sidebar wrapper", () => {
    injectInsightsSidebar();

    const toggleBtn = document.getElementById("stremio-insights-toggle-btn") as HTMLButtonElement;
    const sidebarWrapper = document.getElementById("stremio-insights-sidebar-wrapper") as HTMLDivElement;

    // Open sidebar
    toggleBtn.click();
    expect(sidebarWrapper.classList.contains("open")).toBe(true);

    // Click inside sidebar wrapper
    const childEl = document.createElement("div");
    sidebarWrapper.appendChild(childEl);
    childEl.click();

    expect(sidebarWrapper.classList.contains("open")).toBe(true);
  });
});
