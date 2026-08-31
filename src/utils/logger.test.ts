import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger utility", () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log info messages with [Stremio Insights] prefix", () => {
    logger.info("Test info message", { data: 123 });
    expect(consoleLogSpy).toHaveBeenCalledWith("[Stremio Insights] Test info message", { data: 123 });
  });

  it("should log warn messages with [Stremio Insights] prefix", () => {
    logger.warn("Test warn message");
    expect(consoleWarnSpy).toHaveBeenCalledWith("[Stremio Insights] Test warn message");
  });

  it("should log error messages with [Stremio Insights] prefix", () => {
    logger.error("Test error message", new Error("test error"));
    expect(consoleErrorSpy).toHaveBeenCalledWith("[Stremio Insights] Test error message", expect.any(Error));
  });
});
