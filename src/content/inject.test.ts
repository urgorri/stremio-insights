import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

describe("inject.ts fetch interceptor", () => {
  let originalWindowFetch: typeof window.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    originalWindowFetch = window.fetch;
    mockFetch = vi.fn();
    window.fetch = mockFetch as any;

    // Import inject.ts to apply the interceptor.
    // It will capture our mockFetch as `originalFetch`.
    await import("./inject");
  });

  afterAll(() => {
    window.fetch = originalWindowFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dispatchEventSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockResponse = (body: any) => {
    return {
      clone: () => ({
        json: async () => body
      }),
      json: async () => body
    };
  };

  it("should not intercept unrelated fetch calls", async () => {
    const mockResponse = createMockResponse({ success: true });
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await window.fetch("https://example.com/api/other");

    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/other", undefined);
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it("should intercept datastorePut fetch calls with string URL and JSON string body", async () => {
    const mockResponse = createMockResponse({ updated: true });
    mockFetch.mockResolvedValueOnce(mockResponse);

    const reqBody = { some: "data" };
    const init = {
      method: "POST",
      body: JSON.stringify(reqBody)
    };

    const result = await window.fetch("https://api.strem.io/api/datastorePut", init);

    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith("https://api.strem.io/api/datastorePut", init);

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("STREMIO_DATASTORE_PUT_INTERCEPTED");
    expect(event.detail).toEqual({
      request: reqBody,
      response: { updated: true }
    });
  });

  it("should intercept datastorePut fetch calls and handle empty or non-string body", async () => {
    const mockResponse = createMockResponse({ updated: true });
    mockFetch.mockResolvedValueOnce(mockResponse);

    const init = {
      method: "POST",
      body: new URLSearchParams("foo=bar") as any // non-string body
    };

    const result = await window.fetch("https://api.strem.io/api/datastorePut", init);

    expect(result).toBe(mockResponse);

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("STREMIO_DATASTORE_PUT_INTERCEPTED");
    expect(event.detail).toEqual({
      request: {}, // defaults to empty object
      response: { updated: true }
    });
  });

  it("should handle Request objects instead of string URLs", async () => {
    const mockResponse = createMockResponse({ ok: true });
    mockFetch.mockResolvedValueOnce(mockResponse);

    // Create a mock Request object
    const request = new Request("https://api.strem.io/api/datastorePut", {
      method: "POST",
      body: JSON.stringify({ req: "object" })
    });

    const result = await window.fetch(request);

    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(request, undefined);

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("STREMIO_DATASTORE_PUT_INTERCEPTED");
    expect(event.detail).toEqual({
      request: {}, // body from Request is not extracted directly in the interceptor logic, only from `init.body`
      response: { ok: true }
    });
  });

  it("should catch errors and fallback to original fetch", async () => {
    const mockResponse = createMockResponse({ fallback: true });
    mockFetch
      .mockRejectedValueOnce(new Error("Network error")) // fails in the try block
      .mockResolvedValueOnce(mockResponse); // succeeds in the fallback

    const result = await window.fetch("https://api.strem.io/api/datastorePut");

    expect(result).toBe(mockResponse);

    // The interceptor catches the error from the first mockFetch call,
    // calls console.error, and then calls mockFetch again as a fallback.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Stremio Insights] Error intercepting fetch:",
      expect.any(Error)
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });
});
