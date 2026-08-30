import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("window.fetch interceptor", () => {
  let originalFetch: typeof window.fetch;
  let postMessageSpy: any;
  let consoleErrorSpy: any;
  let mockPort1: { postMessage: any };
  let mockPort2: {};

  beforeEach(() => {
    // Setup initial state before module import or execution
    originalFetch = vi.fn().mockResolvedValue({
      clone: () => ({
        json: vi.fn().mockResolvedValue({ success: true })
      })
    });
    window.fetch = originalFetch;

    postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockPort1 = { postMessage: vi.fn() };
    mockPort2 = {};

    class MockMessageChannel {
      port1 = mockPort1;
      port2 = mockPort2;
    }

    vi.stubGlobal("MessageChannel", MockMessageChannel);

    // Clear module cache to re-execute inject.ts side-effects (window.fetch override)
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("should intercept datastorePut requests and use MessageChannel to transmit sensitive data securely", async () => {
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

    // Ensure window.postMessage was used ONLY to transfer the MessagePort (port2) and not the sensitive data payload
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "STREMIO_DATASTORE_PUT_INTERCEPTED" },
      "*",
      [mockPort2]
    );

    // Ensure sensitive data (request body and response data) is posted through port1 privately
    expect(mockPort1.postMessage).toHaveBeenCalledWith({
      request: requestBody,
      response: mockJson
    });
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
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "STREMIO_DATASTORE_PUT_INTERCEPTED" },
      "*",
      [mockPort2]
    );
    expect(mockPort1.postMessage).toHaveBeenCalledWith({
      request: {},
      response: mockJson
    });
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

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "STREMIO_DATASTORE_PUT_INTERCEPTED" },
      "*",
      [mockPort2]
    );
    expect(mockPort1.postMessage).toHaveBeenCalledWith({
      request: {},
      response: {}
    });
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
