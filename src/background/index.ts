import { convertToCSV, convertToJSON } from "../utils/export";

// On install, we initialize state and set standard defaults
chrome.runtime.onInstalled.addListener(() => {
  console.log("Stremio Insights Service Worker Installed.");
});

async function findStremioTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "https://web.stremio.com/*" }, (tabs) => {
      const err = chrome.runtime.lastError;
      if (err || !tabs || tabs.length === 0) {
        resolve(null);
        return;
      }
      // Prioritize active and non-discarded tabs
      const targetTab = tabs.find(tab => tab.active && !tab.discarded) ||
                        tabs.find(tab => !tab.discarded) ||
                        tabs.find(tab => tab.active) ||
                        tabs[0];
      resolve(targetTab);
    });
  });
}

async function isStremioTabReady(tabId: number): Promise<boolean> {
  try {
    const tab = await new Promise<chrome.tabs.Tab | null>((res) => {
      chrome.tabs.get(tabId, (t) => {
        if (chrome.runtime.lastError) res(null);
        else res(t);
      });
    });
    if (!tab || !tab.url || !tab.url.startsWith("https://web.stremio.com")) {
      return false;
    }
  } catch (err) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, 1500); // 1.5s timeout for handshake response

    chrome.tabs.sendMessage(tabId, { type: "PING" }, (response) => {
      clearTimeout(timeout);
      if (resolved) return;
      resolved = true;
      const err = chrome.runtime.lastError;
      if (err) {
        resolve(false);
      } else if (response && response.type === "CONTENT_SCRIPT_READY") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function injectContentScripts(tabId: number): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const contentScripts = manifest.content_scripts || [];

  for (const cs of contentScripts) {
    if (!cs.js || cs.js.length === 0) continue;
    const isStremio = cs.matches && cs.matches.some(match => match.includes("stremio"));
    if (!isStremio) continue;

    const files = cs.js;
    const world: chrome.scripting.ExecutionWorld = (cs as { world?: string }).world === "MAIN" ? "MAIN" : "ISOLATED";

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files,
        world
      });
    } catch (err) {
      console.error(`[STREMIO] Dynamic injection failed for tab ${tabId} world ${world}:`, err);
    }
  }
}

async function handleCheckStatus(sendResponse: (response: any) => void) {
  try {
    const tab = await findStremioTab();
    if (!tab || !tab.id) {
      sendResponse({ status: "not_open" });
      return;
    }
    const ready = await isStremioTabReady(tab.id);
    if (ready) {
      sendResponse({ status: "ready", tabId: tab.id });
    } else {
      sendResponse({ status: "needs_initialization", tabId: tab.id });
    }
  } catch (err: any) {
    sendResponse({ status: "error", error: err.message || String(err) });
  }
}

async function handleInitializeTab(sendResponse: (response: any) => void) {
  try {
    const tab = await findStremioTab();
    if (!tab || !tab.id) {
      console.log("[STREMIO]\nTab found: false");
      sendResponse({ success: false, error: "Stremio tab not found." });
      return;
    }
    const tabId = tab.id;
    console.log("[STREMIO]\nTab found: true");

    const initiallyReady = await isStremioTabReady(tabId);
    console.log(`[STREMIO]\nContent script ready: ${initiallyReady}`);

    if (!initiallyReady) {
      console.log("[STREMIO]\nInjecting content script...");
      await injectContentScripts(tabId);

      // Verify with handshake retries
      let handshakeSuccessful = false;
      for (let i = 0; i < 3; i++) {
        const ready = await isStremioTabReady(tabId);
        if (ready) {
          handshakeSuccessful = true;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      if (handshakeSuccessful) {
        console.log("[STREMIO]\nHandshake successful");
        sendResponse({ success: true, status: "ready" });
      } else {
        console.error("[STREMIO]\nHandshake failed after injection");
        sendResponse({ success: false, error: "Handshake failed after injection." });
      }
    } else {
      sendResponse({ success: true, status: "ready" });
    }
  } catch (err: any) {
    sendResponse({ success: false, error: err.message || String(err) });
  }
}

async function handleFocusTab(sendResponse: (response: any) => void) {
  try {
    const tab = await findStremioTab();
    if (tab && tab.id) {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Stremio tab not found." });
    }
  } catch (err: any) {
    sendResponse({ success: false, error: err.message || String(err) });
  }
}

async function handleStartSync(sendResponse: (response: any) => void) {
  try {
    const tab = await findStremioTab();
    if (!tab || !tab.id) {
      console.log("[STREMIO]\nTab found: false");
      sendResponse({ success: false, error: "No active Stremio tab found." });
      return;
    }
    const tabId = tab.id;
    console.log("[STREMIO]\nTab found: true");

    let ready = await isStremioTabReady(tabId);
    console.log(`[STREMIO]\nContent script ready: ${ready}`);

    if (!ready) {
      console.log("[STREMIO]\nInjecting content script...");
      await injectContentScripts(tabId);

      // Verify with handshake retries
      let handshakeSuccessful = false;
      for (let i = 0; i < 3; i++) {
        const checkReady = await isStremioTabReady(tabId);
        if (checkReady) {
          handshakeSuccessful = true;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      if (!handshakeSuccessful) {
        console.error("[STREMIO]\nHandshake failed after injection");
        sendResponse({ success: false, error: "Handshake failed after injection." });
        return;
      }
      console.log("[STREMIO]\nHandshake successful");
    }

    console.log("[STREMIO]\nSync started");

    // Make sure tab is active before rescan
    await chrome.tabs.update(tabId, { active: true });

    // Send FORCE_RESCAN with up to 3 retries, exactly matching the store logic but via background channel
    chrome.tabs.sendMessage(tabId, { type: "FORCE_RESCAN" }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.error("[STREMIO] FORCE_RESCAN failed:", err.message);
        sendResponse({ success: false, error: err.message || "Failed to communicate with content script." });
      } else {
        sendResponse(response);
      }
    });
  } catch (err: any) {
    sendResponse({ success: false, error: err.message || String(err) });
  }
}

// Listener for messages from Content Script or UI panels
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DATA_SYNCHRONIZED_EVENT") {
    // Broadcast synchronization occurred
    chrome.runtime.sendMessage({ type: "DATA_SYNCHRONIZED" }).catch(() => {});
    sendResponse({ success: true });
    return false; // Synchronous response, do not return true
  } else if (message.type === "CONTENT_SCRIPT_LOADED") {
    chrome.runtime.sendMessage({ type: "STREMIO_TAB_STATUS_CHANGED" }).catch(() => {});
    sendResponse({ success: true });
    return false;
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
  } else if (message.type === "CHECK_STATUS") {
    handleCheckStatus(sendResponse);
    return true;
  } else if (message.type === "INITIALIZE_STREMIO_TAB") {
    handleInitializeTab(sendResponse);
    return true;
  } else if (message.type === "FOCUS_STREMIO_TAB") {
    handleFocusTab(sendResponse);
    return true;
  } else if (message.type === "START_SYNC") {
    handleStartSync(sendResponse);
    return true;
  }
  // For unhandled messages, do not return true to prevent keeping connection ports open indefinitely
  return false;
});
