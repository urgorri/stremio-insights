import { convertToCSV, convertToJSON } from "../utils/export";

// On install, we initialize state and set standard defaults
chrome.runtime.onInstalled.addListener(() => {
  console.log("Stremio Insights Service Worker Installed.");
});

// Listener for messages from Content Script or UI panels
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DATA_SYNCHRONIZED_EVENT") {
    // Broadcast synchronization occurred
    chrome.runtime.sendMessage({ type: "DATA_SYNCHRONIZED" }).catch(() => {});
    sendResponse({ success: true });
    return false; // Synchronous response, do not return true
  } else if (message.type === "EXPORT_DATA") {
    chrome.storage.local.get(["library"], (res) => {
      const library = res.library || [];
      const format = message.payload?.format;
      let data = "";
      try {
        if (format === "csv") {
          data = convertToCSV(library);
        } else {
          data = convertToJSON(library);
        }
        sendResponse({ success: true, data });
      } catch (err: any) {
        console.error("[Stremio Insights] Export error:", err);
        sendResponse({ success: false, error: err.message || "Failed to format export data" });
      }
    });
    return true; // Keep channel open for asynchronous sendResponse
  }
  // For unhandled messages, do not return true to prevent keeping connection ports open indefinitely
  return false;
});
