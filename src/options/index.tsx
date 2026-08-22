import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "../components/Dashboard";
import "../index.css";

export const OptionsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#090a0f] text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 p-6 rounded-xl border border-purple-500/20 shadow-xl">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Stremio Insights
          </h1>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Welcome to your full-screen options and dashboard. View statistics, explore your viewing timeline, export your backup database, or trigger a cloud synchronization.
          </p>
        </div>

        {/* Embedded Dashboard */}
        <div className="bg-[#0d0e15] rounded-xl border border-gray-800 shadow-2xl overflow-hidden h-[750px]">
          <Dashboard />
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-gray-500 pt-4 space-y-1">
          <p>Stremio Insights is an independent open-source Chrome Extension. All data is stored locally in your browser.</p>
          <p>Read our 100% local <a href="docs/index.html" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Privacy Policy</a>.</p>
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
