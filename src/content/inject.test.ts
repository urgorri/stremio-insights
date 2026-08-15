import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("window.fetch interceptor", () => {
  let originalFetch: typeof window.fetch;
  let dispatchEventSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Setup initial state before module import or execution
    originalFetch = vi.fn().mockResolvedValue({
      clone: () => ({
        json: vi.fn().mockResolvedValue({ success: true })
      })
    });
    window.fetch = originalFetch;

    dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Clear module cache to re-execute inject.ts side-effects (window.fetch override)
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function injectInterceptor() {
    await import("./inject.ts");
  }

  it("should inject successfully and override window.fetch", async () => {
    await injectInterceptor();
    expect(window.fetch).not.toBe(originalFetch);
  });

  it("should pass through normal requests without modification", async () => {
    await injectInterceptor();
    const mockResponse = { ok: true };
    (originalFetch as any).mockResolvedValue(mockResponse);

    const response = await window.fetch("https://api.example.com/data");

    expect(originalFetch).toHaveBeenCalledWith("https://api.example.com/data", undefined);
    expect(response).toBe(mockResponse);
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it("should intercept datastorePut requests and dispatch CustomEvent with parsed body", async () => {
    await injectInterceptor();

    const requestBody = { id: 123, action: "update" };
    const mockJson = { result: "ok" };
    const mockClone = {
      json: vi.fn().mockResolvedValue(mockJson)
    };
    const mockResponse = {
      clone: () => mockClone
    };
    (originalFetch as any).mockResolvedValue(mockResponse);

    const response = await window.fetch("https://api.strem.io/api/datastorePut", {
      method: "POST",
      body: JSON.stringify(requestBody)
    });

    expect(originalFetch).toHaveBeenCalledWith("https://api.strem.io/api/datastorePut", expect.any(Object));
    expect(response).toBe(mockResponse);
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "STREMIO_DATASTORE_PUT_INTERCEPTED",
        detail: {
          request: requestBody,
          response: mockJson
        }
      })
    );
  });

  it("should handle Request object inputs instead of string urls", async () => {
    await injectInterceptor();

    const request = new Request("https://api.strem.io/api/datastorePut", {
      method: "POST",
      body: JSON.stringify({ test: true })
    });

    const mockJson = { result: "ok" };
    const mockResponse = {
      clone: () => ({ json: vi.fn().mockResolvedValue(mockJson) })
    };
    (originalFetch as any).mockResolvedValue(mockResponse);

    await window.fetch(request);

    expect(originalFetch).toHaveBeenCalledWith(request, undefined);
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "STREMIO_DATASTORE_PUT_INTERCEPTED"
      })
    );
  });

  it("should handle body not being a string safely", async () => {
    await injectInterceptor();

    const mockResponse = {
      clone: () => ({ json: vi.fn().mockResolvedValue({}) })
    };
    (originalFetch as any).mockResolvedValue(mockResponse);

    const bodyObj = new FormData();

    await window.fetch("https://api.strem.io/api/datastorePut", {
      method: "POST",
      body: bodyObj as any
    });

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "STREMIO_DATASTORE_PUT_INTERCEPTED",
        detail: expect.objectContaining({
          request: {} // defaults to empty object
        })
      })
    );
  });

  it("should catch errors in interceptor and fallback to original request silently (logged to console)", async () => {
    await injectInterceptor();

    const requestBody = "invalid-json"; // This string will be parsed by JSON.parse because body is string but it's invalid

    // the interceptor throws during `JSON.parse(init.body)`
    // then falls back to originalFetch
    const mockResponse = { ok: true };
    (originalFetch as any).mockResolvedValue(mockResponse);

    const response = await window.fetch("https://api.strem.io/api/datastorePut", {
      method: "POST",
      body: requestBody
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("[Stremio Insights] Error intercepting fetch:", expect.any(Error));
    expect(originalFetch).toHaveBeenCalledWith("https://api.strem.io/api/datastorePut", expect.any(Object));
    expect(response).toBe(mockResponse);
  });
});
