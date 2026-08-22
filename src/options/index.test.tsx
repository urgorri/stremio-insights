import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { OptionsPage } from "./index";

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("OptionsPage Component", () => {
  it("should render OptionsPage title, description, and privacy policy link", () => {
    render(<OptionsPage />);
    expect(screen.getAllByText("Stremio Insights").length).toBeGreaterThan(0);
    expect(screen.getByText(/Welcome to your full-screen options and dashboard/i)).toBeTruthy();
    expect(screen.getByText(/Privacy Policy/i)).toBeTruthy();
  });
});
