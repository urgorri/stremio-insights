import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("Background Service Worker - FETCH_OMDB_DATA proxy", () => {
  let messageListener: Function | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    messageListener = null;

    vi.spyOn(chrome.runtime.onMessage, "addListener").mockImplementation((listener) => {
      messageListener = listener;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle FETCH_OMDB_DATA message and proxy request securely", async () => {
    await import("./index");

    expect(messageListener).not.toBeNull();

    vi.spyOn(chrome.storage.local, "get").mockImplementation(((keys: any) => {
      if (Array.isArray(keys) && keys.includes("omdb_api_key")) {
        return Promise.resolve({ omdb_api_key: "test_key_123" });
      }
      return Promise.resolve({});
    }) as any);

    const mockOmdbResponse = { Response: "True", Title: "Inception", Year: "2010" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockOmdbResponse
    } as Response);

    const sendResponse = vi.fn();
    const result = messageListener!({ type: "FETCH_OMDB_DATA", cleanId: "tt1375666" }, {}, sendResponse);

    expect(result).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledWith("https://www.omdbapi.com/?i=tt1375666&apikey=test_key_123");
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: mockOmdbResponse });
  });

  it("should return success with null data if omdb_api_key is not configured", async () => {
    await import("./index");

    vi.spyOn(chrome.storage.local, "get").mockImplementation(((keys: any) => {
      return Promise.resolve({ omdb_api_key: undefined });
    }) as any);

    const sendResponse = vi.fn();
    messageListener!({ type: "FETCH_OMDB_DATA", cleanId: "tt1375666" }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 50));

    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: null });
  });

  it("should handle invalid cleanId safely", async () => {
    await import("./index");

    const sendResponse = vi.fn();
    messageListener!({ type: "FETCH_OMDB_DATA", cleanId: null }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 50));

    expect(sendResponse).toHaveBeenCalledWith({ success: false, data: null, error: "Invalid cleanId" });
  });
});
