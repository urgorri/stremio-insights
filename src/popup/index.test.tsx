import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PopupApp } from "./index";

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("PopupApp Component", () => {
  it("should render PopupApp containing Dashboard", () => {
    render(<PopupApp />);
    expect(screen.getByText("Stremio Insights")).toBeTruthy();
  });
});
