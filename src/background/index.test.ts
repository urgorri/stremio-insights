import { describe, expect, it, beforeEach, vi, afterEach, beforeAll, afterAll } from "vitest";

let messageListener: (message: any, sender: any, sendResponse: (res: any) => void) => boolean | undefined;
let installedListener: (() => void) | null = null;

const mockTabsQuery = vi.fn();
const mockTabsGet = vi.fn();
const mockTabsSendMessage = vi.fn();
const mockTabsUpdate = vi.fn().mockResolvedValue({});
const mockWindowsUpdate = vi.fn().mockResolvedValue({});
const mockExecuteScript = vi.fn();
const mockStorageGet = vi.fn();
const mockGetManifest = vi.fn().mockReturnValue({
  content_scripts: [
    {
      matches: ["https://web.stremio.com/*"],
      js: ["content.js"],
      world: "ISOLATED"
    },
    {
      matches: ["https://web.stremio.com/*"],
      js: ["inject.js"],
      world: "MAIN"
    },
    {
      matches: ["https://other.com/*"],
      js: ["other.js"]
    },
    {
      matches: ["https://web.stremio.com/*"],
      js: []
    }
  ]
});

let originalChrome: typeof global.chrome;

describe("Background Service Worker", () => {
  beforeAll(async () => {
    originalChrome = global.chrome;

    global.chrome = {
      runtime: {
        onInstalled: {
          addListener: vi.fn((fn) => {
            installedListener = fn;
          })
        },
        onMessage: {
          addListener: vi.fn((fn) => {
            messageListener = fn;
          })
        },
        sendMessage: vi.fn().mockResolvedValue({}),
        getManifest: mockGetManifest,
        lastError: undefined
      },
      tabs: {
        query: mockTabsQuery,
        get: mockTabsGet,
        sendMessage: mockTabsSendMessage,
        update: mockTabsUpdate
      },
      windows: {
        update: mockWindowsUpdate
      },
      scripting: {
        executeScript: mockExecuteScript
      },
      storage: {
        local: {
          get: mockStorageGet
        }
      }
    } as any;

    await import("./index");
  });

  afterAll(() => {
    global.chrome = originalChrome;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.chrome.runtime.lastError = undefined;
    mockExecuteScript.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("onInstalled Listener", () => {
    it("should register onInstalled listener and log installation message", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      expect(installedListener).not.toBeNull();
      installedListener!();
      expect(consoleSpy).toHaveBeenCalledWith("Stremio Insights Service Worker Installed.");
      consoleSpy.mockRestore();
    });
  });

  describe("onMessage Listener - Simple Events", () => {
    it("should handle DATA_SYNCHRONIZED_EVENT by broadcasting DATA_SYNCHRONIZED and returning false", () => {
      const sendResponse = vi.fn();
      const message = { type: "DATA_SYNCHRONIZED_EVENT" };

      const result = messageListener(message, {}, sendResponse);

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "DATA_SYNCHRONIZED" });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(false);
    });

    it("should handle CONTENT_SCRIPT_LOADED by broadcasting STREMIO_TAB_STATUS_CHANGED and returning false", () => {
      const sendResponse = vi.fn();
      const message = { type: "CONTENT_SCRIPT_LOADED" };

      const result = messageListener(message, {}, sendResponse);

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "STREMIO_TAB_STATUS_CHANGED" });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(false);
    });

    it("should return false for unhandled message types", () => {
      const sendResponse = vi.fn();
      const message = { type: "UNKNOWN_MESSAGE_TYPE" };

      const result = messageListener(message, {}, sendResponse);

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });

  describe("onMessage Listener - EXPORT_DATA", () => {
    it("should export JSON data when payload format is json or empty", () => {
      const sendResponse = vi.fn();
      const mockLibrary = [{ imdb_id: "tt1234567", title: "Test Movie", type: "movie", year: 2024 }];

      mockStorageGet.mockImplementation((keys, callback) => {
        callback({ library: mockLibrary });
      });

      const result = messageListener({ type: "EXPORT_DATA", payload: { format: "json" } }, {}, sendResponse);

      expect(result).toBe(true);
      expect(mockStorageGet).toHaveBeenCalledWith(["library"], expect.any(Function));
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.stringContaining("tt1234567")
      });
    });

    it("should export CSV data when payload format is csv", () => {
      const sendResponse = vi.fn();
      const mockLibrary = [{ imdb_id: "tt1234567", title: "Test Movie", type: "movie", year: 2024 }];

      mockStorageGet.mockImplementation((keys, callback) => {
        callback({ library: mockLibrary });
      });

      const result = messageListener({ type: "EXPORT_DATA", payload: { format: "csv" } }, {}, sendResponse);

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.stringContaining("IMDb ID")
      });
    });

    it("should handle export errors gracefully", () => {
      const sendResponse = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Pass a circular structure to trigger export error
      const circularLibrary: any = [];
      circularLibrary.push(circularLibrary);

      mockStorageGet.mockImplementation((keys, callback) => {
        callback({ library: circularLibrary });
      });

      const result = messageListener({ type: "EXPORT_DATA" }, {}, sendResponse);

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining("Converting circular structure to JSON")
      });

      consoleSpy.mockRestore();
    });

    it("should handle CSV formatting errors when convertToCSV throws an error", () => {
      const sendResponse = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Pass library item with invalid genres that causes convertToCSV to throw
      const invalidLibrary: any = [{ imdb_id: "tt123", genres: 12345 }];

      mockStorageGet.mockImplementation((keys, callback) => {
        callback({ library: invalidLibrary });
      });

      const result = messageListener({ type: "EXPORT_DATA", payload: { format: "csv" } }, {}, sendResponse);

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.stringMatching(/join is not a function|TypeError/)
      });

      consoleSpy.mockRestore();
    });

    it("should fallback to default error message when thrown error has no message property", () => {
      const sendResponse = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Create an object whose property getter throws a raw object with no message
      const invalidItem = {};
      Object.defineProperty(invalidItem, "imdb_id", {
        get() {
          throw { customError: "No message property" };
        }
      });

      mockStorageGet.mockImplementation((keys, callback) => {
        callback({ library: [invalidItem] });
      });

      const result = messageListener({ type: "EXPORT_DATA", payload: { format: "csv" } }, {}, sendResponse);

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Failed to format export data"
      });

      consoleSpy.mockRestore();
    });

    it("should handle empty or missing library gracefully", () => {
      const sendResponse = vi.fn();

      mockStorageGet.mockImplementation((keys, callback) => {
        callback({}); // library is undefined
      });

      const result = messageListener({ type: "EXPORT_DATA" }, {}, sendResponse);

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: "[]"
      });
    });
  });

  describe("CHECK_STATUS Message", () => {
    it("should return not_open status if no Stremio tab is found", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([]));

      const result = messageListener({ type: "CHECK_STATUS" }, {}, sendResponse);
      expect(result).toBe(true);

      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ status: "not_open" });
    });

    it("should return ready status if Stremio tab responds to PING handshake", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 101, url: "https://web.stremio.com/#/", active: true, discarded: false }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 101, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") cb({ type: "CONTENT_SCRIPT_READY" });
      });

      messageListener({ type: "CHECK_STATUS" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ status: "ready", tabId: 101 });
    });

    it("should return needs_initialization status if Stremio tab PING handshake fails or times out", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 102, url: "https://web.stremio.com/#/", active: true, discarded: false }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 102, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") cb(null);
      });

      messageListener({ type: "CHECK_STATUS" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ status: "needs_initialization", tabId: 102 });
    });

    it("should handle errors during CHECK_STATUS", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation(() => {
        throw new Error("Tab query failed");
      });

      messageListener({ type: "CHECK_STATUS" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ status: "error", error: "Tab query failed" });
    });
  });

  describe("INITIALIZE_STREMIO_TAB Message", () => {
    it("should fail if no Stremio tab is found", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([]));

      messageListener({ type: "INITIALIZE_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "Stremio tab not found." });
    });

    it("should return success if tab is already ready", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 201, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 201, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") cb({ type: "CONTENT_SCRIPT_READY" });
      });

      messageListener({ type: "INITIALIZE_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: true, status: "ready" });
      expect(mockExecuteScript).not.toHaveBeenCalled();
    });

    it("should inject content scripts and succeed when handshake succeeds on retry", async () => {
      const sendResponse = vi.fn();
      let pingAttempts = 0;

      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 202, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 202, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") {
          pingAttempts++;
          if (pingAttempts > 1) {
            cb({ type: "CONTENT_SCRIPT_READY" });
          } else {
            cb(null);
          }
        }
      });

      messageListener({ type: "INITIALIZE_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(mockExecuteScript).toHaveBeenCalledTimes(2); // ISOLATED & MAIN
      expect(sendResponse).toHaveBeenCalledWith({ success: true, status: "ready" });
    });

    it("should return error if handshake fails after injection", async () => {
      const sendResponse = vi.fn();

      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 203, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 203, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") cb(null);
      });

      messageListener({ type: "INITIALIZE_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(mockExecuteScript).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "Handshake failed after injection." });
    });

    it("should handle injection exceptions gracefully", async () => {
      const sendResponse = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 204, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 204, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        cb(null);
      });
      mockExecuteScript.mockRejectedValue(new Error("Injection failed"));

      messageListener({ type: "INITIALIZE_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "Handshake failed after injection." });

      consoleSpy.mockRestore();
    });
  });

  describe("FOCUS_STREMIO_TAB Message", () => {
    it("should activate tab and focus window if Stremio tab exists", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 301, windowId: 501 }]));

      messageListener({ type: "FOCUS_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(mockTabsUpdate).toHaveBeenCalledWith(301, { active: true });
      expect(mockWindowsUpdate).toHaveBeenCalledWith(501, { focused: true });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it("should return error if no Stremio tab exists", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([]));

      messageListener({ type: "FOCUS_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "Stremio tab not found." });
    });

    it("should handle errors during focus tab", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation(() => {
        throw new Error("Window update error");
      });

      messageListener({ type: "FOCUS_STREMIO_TAB" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "Window update error" });
    });
  });

  describe("START_SYNC Message", () => {
    it("should return error if no Stremio tab found", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([]));

      messageListener({ type: "START_SYNC" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "No active Stremio tab found." });
    });

    it("should perform sync successfully when tab is ready", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 401, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 401, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") {
          cb({ type: "CONTENT_SCRIPT_READY" });
        } else if (msg.type === "FORCE_RESCAN") {
          cb({ success: true, count: 42 });
        }
      });

      messageListener({ type: "START_SYNC" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(mockTabsSendMessage).toHaveBeenCalledWith(401, { type: "FORCE_RESCAN" }, expect.any(Function));
      expect(sendResponse).toHaveBeenCalledWith({ success: true, count: 42 });
    });

    it("should inject scripts, retry handshake, and force rescan when tab is not initially ready", async () => {
      const sendResponse = vi.fn();
      let pingCount = 0;

      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 402, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 402, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") {
          pingCount++;
          if (pingCount > 1) {
            cb({ type: "CONTENT_SCRIPT_READY" });
          } else {
            cb(null);
          }
        } else if (msg.type === "FORCE_RESCAN") {
          cb({ success: true, itemsSynced: 10 });
        }
      });

      messageListener({ type: "START_SYNC" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(mockExecuteScript).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true, itemsSynced: 10 });
    });

    it("should return error if handshake fails after script injection during START_SYNC", async () => {
      const sendResponse = vi.fn();

      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 403, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 403, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") cb(null);
      });

      messageListener({ type: "START_SYNC" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "Handshake failed after injection." });
    });

    it("should handle lastError when sending FORCE_RESCAN message", async () => {
      const sendResponse = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 404, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 404, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => {
        if (msg.type === "PING") {
          cb({ type: "CONTENT_SCRIPT_READY" });
        } else if (msg.type === "FORCE_RESCAN") {
          global.chrome.runtime.lastError = { message: "Script disconnected" } as any;
          cb(null);
        }
      });

      messageListener({ type: "START_SYNC" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: "Script disconnected" });

      consoleSpy.mockRestore();
    });
  });

  describe("Tab selection priority in findStremioTab and url validation in isStremioTabReady", () => {
    it("should prioritize active and non-discarded tab over other tabs", async () => {
      const sendResponse = vi.fn();
      const tabs = [
        { id: 1, active: false, discarded: false },
        { id: 2, active: true, discarded: false },
        { id: 3, active: true, discarded: true }
      ];

      mockTabsQuery.mockImplementation((query, cb) => cb(tabs));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: tabId, url: "https://web.stremio.com/#/" }));
      mockTabsSendMessage.mockImplementation((tabId, msg, cb) => cb({ type: "CONTENT_SCRIPT_READY" }));

      messageListener({ type: "CHECK_STATUS" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ status: "ready", tabId: 2 });
    });

    it("should return false for isStremioTabReady if tab url does not start with https://web.stremio.com", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 501, url: "https://other.com" }]));
      mockTabsGet.mockImplementation((tabId, cb) => cb({ id: 501, url: "https://other.com" }));

      messageListener({ type: "CHECK_STATUS" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ status: "needs_initialization", tabId: 501 });
    });

    it("should return false for isStremioTabReady if chrome.tabs.get sets lastError", async () => {
      const sendResponse = vi.fn();
      mockTabsQuery.mockImplementation((query, cb) => cb([{ id: 502, url: "https://web.stremio.com/#/" }]));
      mockTabsGet.mockImplementation((tabId, cb) => {
        global.chrome.runtime.lastError = { message: "Tab not found" } as any;
        cb(null);
      });

      messageListener({ type: "CHECK_STATUS" }, {}, sendResponse);
      await vi.runAllTimersAsync();

      expect(sendResponse).toHaveBeenCalledWith({ status: "needs_initialization", tabId: 502 });
    });
  });
});
