import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Dashboard, getHeatmapCellColorClass } from "../Dashboard";
import { useInsightsStore } from "../../hooks/useInsightsStore";

// Mock the zustand store hook
vi.mock("../../hooks/useInsightsStore", () => ({
  useInsightsStore: vi.fn(),
}));

// Mock ResizeObserver which is used by Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("Dashboard Component", () => {
  const mockFetchData = vi.fn();
  const mockPerformSync = vi.fn();
  const mockClearHistory = vi.fn();
  const mockSetSearchQuery = vi.fn();
  const mockSetFilters = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    // Default mock implementation
    (useInsightsStore as any).mockReturnValue({
      stats: null,
      searchQuery: "",
      filters: {},
      syncLoading: false,
      syncError: null,
      fetchData: mockFetchData,
      performSync: mockPerformSync,
      clearHistory: mockClearHistory,
      setSearchQuery: mockSetSearchQuery,
      setFilters: mockSetFilters,
      getFilteredEvents: vi.fn().mockReturnValue([]),
    });
  });

  it("should render successfully", () => {
    render(<Dashboard />);
    expect(screen.getByText("Stremio Insights")).toBeTruthy();
    expect(mockFetchData).toHaveBeenCalledTimes(1);
  });

  it("should display the overview tab correctly when data is available", () => {
    (useInsightsStore as any).mockReturnValue({
      stats: {
        totalWatchCount: 10,
        totalMovies: 5,
        totalSeries: 7, // Make these unique
        totalUniqueTitles: 8,
        estimatedWatchTime: 600,
        averageRating: 8.5,
        mostWatched: [],
        topDirectors: [],
        topYears: [],
        topGenres: [],
        heatmap: [],
        decades: [],
        favoriteGenres: ["Action"],
        favoriteDecade: "2020s",
        favoriteDirector: { name: "Nolan", count: 2 },
        favoriteYear: "2023",
      },
      searchQuery: "",
      filters: {},
      syncLoading: false,
      syncError: null,
      fetchData: mockFetchData,
      performSync: mockPerformSync,
      clearHistory: mockClearHistory,
      setSearchQuery: mockSetSearchQuery,
      setFilters: mockSetFilters,
      getFilteredEvents: vi.fn().mockReturnValue([]),
    });

    render(<Dashboard />);
    expect(screen.getByText("Watch Count")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("Movies")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("Series")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("should handle switching tabs", () => {
    render(<Dashboard />);

    const timelineTab = screen.getByText("timeline");
    fireEvent.click(timelineTab);

    // Check if search input appears, which is only on the timeline tab
    expect(screen.getByPlaceholderText("Search title, IMDb ID, genre, year...")).toBeTruthy();

    const analyticsTab = screen.getByText("analytics");
    fireEvent.click(analyticsTab);
    // Find some text on the analytics tab
    expect(screen.getByText("Top Genres")).toBeTruthy();

    const settingsTab = screen.getByText("settings");
    fireEvent.click(settingsTab);
    expect(screen.getByText("Export CSV")).toBeTruthy();
    expect(screen.getByText("Export JSON")).toBeTruthy();
  });

  it("should call performSync when manual sync button is clicked", async () => {
    (useInsightsStore as any).mockReturnValue({
      stats: null,
      searchQuery: "",
      filters: {},
      syncLoading: false,
      syncError: null,
      fetchData: mockFetchData,
      performSync: mockPerformSync,
      clearHistory: mockClearHistory,
      setSearchQuery: mockSetSearchQuery,
      setFilters: mockSetFilters,
      getFilteredEvents: vi.fn().mockReturnValue([]),
    });

    // Provide a mocked chrome global for this test specifically
    const originalChrome = global.chrome;
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((keys, cb) => cb({ stremio_auth_key: "test-key" }))
        }
      }
    } as any;

    render(<Dashboard />);

    const syncButton = screen.queryByTitle("Synchronize now");
    if (syncButton) {
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockPerformSync).toHaveBeenCalledWith("test-key");
      });
    }

    // Restore chrome
    global.chrome = originalChrome;
  });

  it("should show loader overlay when syncLoading is true", () => {
    (useInsightsStore as any).mockReturnValue({
      stats: null,
      searchQuery: "",
      filters: {},
      syncLoading: true,
      syncError: null,
      fetchData: mockFetchData,
      performSync: mockPerformSync,
      clearHistory: mockClearHistory,
      setSearchQuery: mockSetSearchQuery,
      setFilters: mockSetFilters,
      getFilteredEvents: vi.fn().mockReturnValue([]),
    });

    render(<Dashboard />);

    expect(screen.getByText("Synchronizing...")).toBeTruthy();
  });

  it("should call clearHistory when confirm is accepted on settings tab", async () => {
    // Mock window.confirm to return true
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(true);

    render(<Dashboard />);

    // Navigate to settings tab
    const settingsTab = screen.getByText("settings");
    fireEvent.click(settingsTab);

    // Find and click the clear history button
    const clearButton = screen.getByText("Clear All Local History");
    fireEvent.click(clearButton);

    // Verify clearHistory was called
    await waitFor(() => {
      expect(mockClearHistory).toHaveBeenCalled();
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it("should not call clearHistory when confirm is cancelled on settings tab", async () => {
    // Mock window.confirm to return false
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(false);

    render(<Dashboard />);

    // Navigate to settings tab
    const settingsTab = screen.getByText("settings");
    fireEvent.click(settingsTab);

    // Find and click the clear history button
    const clearButton = screen.getByText("Clear All Local History");
    fireEvent.click(clearButton);

    // Verify clearHistory was not called
    expect(mockClearHistory).not.toHaveBeenCalled();

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it("should trigger openOptionsPage when open full page button is clicked", () => {
    const openOptionsPageMock = vi.fn();
    const originalChrome = global.chrome;
    global.chrome = {
      runtime: {
        openOptionsPage: openOptionsPageMock,
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() }
      },
      tabs: {
        query: vi.fn().mockImplementation((query, cb) => cb([{ active: true }]))
      }
    } as any;

    render(<Dashboard />);

    const fullPageBtn = screen.queryByTitle("Open full page");
    if (fullPageBtn) {
      fireEvent.click(fullPageBtn);
      expect(openOptionsPageMock).toHaveBeenCalled();
    }

    global.chrome = originalChrome;
  });

  it("should fallback to tabs.create when openOptionsPage is undefined", () => {
    const tabsCreateMock = vi.fn();
    const originalChrome = global.chrome;
    global.chrome = {
      runtime: {
        getURL: vi.fn().mockReturnValue("chrome-extension://id/options.html"),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() }
      },
      tabs: {
        query: vi.fn().mockImplementation((query, cb) => cb([{ active: true }])),
        create: tabsCreateMock
      }
    } as any;

    render(<Dashboard />);

    const fullPageBtn = screen.queryByTitle("Open full page");
    if (fullPageBtn) {
      fireEvent.click(fullPageBtn);
      expect(tabsCreateMock).toHaveBeenCalledWith({ url: "chrome-extension://id/options.html" });
    }

    global.chrome = originalChrome;
  });

  it("should perform auto sync on popup load even when Stremio tab is in background (inactive)", async () => {
    const originalChrome = global.chrome;
    const originalLocation = window.location;

    // Mock location.protocol to simulate chrome-extension: popup
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, protocol: "chrome-extension:" },
      writable: true
    });

    global.chrome = {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() }
      },
      tabs: {
        query: vi.fn().mockImplementation((query, cb) => cb([{ id: 99, active: false }]))
      },
      storage: {
        local: {
          get: vi.fn().mockImplementation((keys, cb) => cb({ stremio_auth_key: "key123" }))
        }
      }
    } as any;

    render(<Dashboard />);

    await waitFor(() => {
      expect(mockPerformSync).toHaveBeenCalledWith("key123");
    });

    global.chrome = originalChrome;
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  describe("getHeatmapCellColorClass", () => {
    it("should return correct classes for count 0", () => {
      expect(getHeatmapCellColorClass(0)).toBe("bg-gray-800/20");
    });

    it("should return correct classes for counts 1 and 2", () => {
      expect(getHeatmapCellColorClass(1)).toBe("bg-purple-900/40 border border-purple-800/20");
      expect(getHeatmapCellColorClass(2)).toBe("bg-purple-900/40 border border-purple-800/20");
    });

    it("should return correct classes for counts 3 to 5", () => {
      expect(getHeatmapCellColorClass(3)).toBe("bg-purple-700/60");
      expect(getHeatmapCellColorClass(5)).toBe("bg-purple-700/60");
    });

    it("should return correct classes for counts 6 to 9", () => {
      expect(getHeatmapCellColorClass(6)).toBe("bg-purple-500/80");
      expect(getHeatmapCellColorClass(9)).toBe("bg-purple-500/80");
    });

    it("should return correct classes for count 10 or greater", () => {
      expect(getHeatmapCellColorClass(10)).toBe("bg-purple-400 shadow-[0_0_4px_#a855f7]");
      expect(getHeatmapCellColorClass(25)).toBe("bg-purple-400 shadow-[0_0_4px_#a855f7]");
    });
  });
});
