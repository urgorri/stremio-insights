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
  }
  return true; // Keep channel open
});
