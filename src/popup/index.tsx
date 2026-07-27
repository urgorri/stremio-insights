import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "../components/Dashboard";
import "../index.css";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <div style={{ width: "380px", height: "550px" }}>
        <Dashboard />
      </div>
    </React.StrictMode>
  );
}
