import { vi } from "vitest";

// Mock chrome extension APIs
const chromeMock = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({}),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onInstalled: {
      addListener: vi.fn()
    },
    id: "mock-extension-id"
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn()
    },
    onChanged: {
      addListener: vi.fn()
    }
  }
};

global.chrome = chromeMock as any;
