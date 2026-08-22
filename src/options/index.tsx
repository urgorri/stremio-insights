import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "../components/Dashboard";
import "../index.css";

export const OptionsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#090a0f] text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 p-6 rounded-xl border border-purple-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Stremio Insights
            </h1>
            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
              Welcome to your full-screen options and dashboard. View statistics, explore your viewing timeline, export your backup database, or trigger a cloud synchronization.
            </p>
          </div>
          <a
            href="https://github.com/urgorri/stremio-insights"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm font-medium text-purple-300 transition-colors"
          >
            GitHub Repository
          </a>
        </div>

        {/* Embedded Dashboard */}
        <div className="bg-[#0d0e15] rounded-xl border border-gray-800 shadow-2xl overflow-hidden h-[750px]">
          <Dashboard />
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-gray-500 pt-4 space-y-1">
          <p>
            Stremio Insights is an independent open-source Chrome Extension. View source on{" "}
            <a
              href="https://github.com/urgorri/stremio-insights"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              GitHub
            </a>
            . All data is stored locally in your browser.
          </p>
          <p>
            Read our 100% local{" "}
            <a
              href={typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL("docs/index.html") : "docs/index.html"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <OptionsPage />
    </React.StrictMode>
  );
}
