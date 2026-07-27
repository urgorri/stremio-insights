import React from "react";
import { createRoot } from "react-dom/client";
import { PlaybackEvent } from "../types";
import { formatBuenosAiresDate } from "../utils/date";
import { parsePlayerHash } from "../utils/hash";
import { Dashboard } from "../components/Dashboard";

// Store reference to current active video element and its events
let currentVideoElement: HTMLVideoElement | null = null;
let currentPlaySession: {
  imdb_id: string;
  title: string;
  type: "movie" | "series";
  season?: number;
  episode?: number;
  started_at: string;
  lastProgressSent: number;
} | null = null;

// Track processed cards to prevent infinite cycles
const processedCardHashes = new Set<string>();

// Tracking mutations
let mutationCount = 0;

/**
 * Log comprehensive environment diagnostics on startup
 */
function logInitialDiagnostics() {
  console.log("[Stremio Insights Diagnostics] Content Script successfully loaded.");
  console.log("[Stremio Insights Diagnostics] URL:", window.location.href);
  console.log("[Stremio Insights Diagnostics] Hash:", window.location.hash);
  console.log("[Stremio Insights Diagnostics] readyState:", document.readyState);
  console.log("[Stremio Insights Diagnostics] localStorage keys found:", Object.keys(localStorage));
  console.log("[Stremio Insights Diagnostics] sessionStorage keys found:", Object.keys(sessionStorage));

  if (window.indexedDB && typeof window.indexedDB.databases === "function") {
    window.indexedDB.databases().then((dbs) => {
      console.log("[Stremio Insights Diagnostics] Initial IndexedDB databases discovered:", dbs);
    }).catch(err => {
      console.error("[Stremio Insights Diagnostics] Initial database listing failed:", err);
    });
  }
}

/**
 * CSS-independent DOM extraction fallback for library items
 */
function extractFromDOM(): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  const anchors = document.querySelectorAll<HTMLAnchorElement>(
    "a[href*='#/detail/'], a[href*='#/player/']"
  );

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) return;

    let type: "movie" | "series" | null = null;
    let id = "";

    if (href.includes("#/detail/")) {
      const parts = href.split("/");
      if (parts.length >= 4) {
        type = parts[2] as any;
        id = parts[3];
      }
    } else if (href.includes("#/player/")) {
      const parts = href.split("/");
      if (parts.length >= 5) {
        type = parts[3] as any;
        id = parts[4];
      }
    }

    if (!type || !id || (type !== "movie" && type !== "series")) return;

    let title = "";
    const titleEl = anchor.querySelector(".title, .name, .meta-title, .label, p, span");
    if (titleEl && titleEl.textContent) {
      title = titleEl.textContent.trim();
    }
    if (!title && anchor.textContent) {
      title = anchor.textContent.trim().split("\n")[0].trim();
    }
    if (!title) {
      title = "Unknown Title";
    }

    // Extract progress percentage from style containing width: XX%
    let progress = 100;
    const childDivs = anchor.querySelectorAll("div");
    for (const div of childDivs) {
      const style = div.getAttribute("style");
      if (style) {
        const match = style.match(/width:\s*(\d+(?:\.\d+)?)%/i);
        if (match) {
          progress = Math.round(parseFloat(match[1]));
          break;
        }
      }
    }

    const duration = 3600000;
    const time_watched = Math.round((duration * progress) / 100);

    events.push({
      imdb_id: id,
      title,
      type,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      progress,
      watch_count: 1,
      duration,
      time_watched,
      genres: ["Historical"]
    });
  });

  return events;
}

/**
 * Run a full discovery of Stremio's data (IndexedDB, LocalStorage) and fall back to DOM.
 * Store the combined watch history in chrome.storage.local and sync with extension's IndexedDB.
 */
async function discoverAndSyncData(): Promise<number> {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    hash: window.location.hash,
    readyState: document.readyState,
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
    databases: [],
    indexedDBRecordsFound: 0,
    libraryItemsDiscoveredInIndexedDB: 0,
    libraryItemsDiscoveredInLocalStorage: 0,
    domExtractedCount: 0
  };

  console.log("[Stremio Insights Diagnostics] Starting synchronization run...");

  // 1. Discover and query IndexedDB databases
  const discoveredLibraryItems: any[] = [];
  try {
    if (window.indexedDB && typeof window.indexedDB.databases === "function") {
      const dbs = await window.indexedDB.databases();
      diagnostics.databases = dbs;
      console.log("[Stremio Insights Diagnostics] Discovered databases:", dbs);
    }
  } catch (e) {
    console.error("[Stremio Insights Diagnostics] Error listing databases:", e);
  }

  // Common database name candidates in Stremio
  const dbNamesToTry = [...new Set([
    ...(diagnostics.databases || []).map((d: any) => d.name),
    "stremio-core",
    "stremio_core",
    "localforage",
    "keyval-store"
  ])].filter(Boolean);

  for (const dbName of dbNamesToTry) {
    try {
      const dbInfo = await new Promise<any>((resolve) => {
        const req = window.indexedDB.open(dbName);
        req.onsuccess = (e: any) => {
          const db = e.target.result;
          const stores = Array.from(db.objectStoreNames);
          db.close();
          resolve({ name: dbName, stores });
        };
        req.onerror = () => resolve(null);
      });

      if (dbInfo && dbInfo.stores.length > 0) {
        console.log(`[Stremio Insights Diagnostics] DB "${dbName}" stores:`, dbInfo.stores);

        for (const storeName of dbInfo.stores) {
          try {
            const records: any[] = await new Promise((resolve) => {
              const req = window.indexedDB.open(dbName);
              req.onsuccess = (e: any) => {
                const db = e.target.result;
                try {
                  const tx = db.transaction(storeName, "readonly");
                  const store = tx.objectStore(storeName);
                  const getAllReq = store.getAll();
                  getAllReq.onsuccess = (evt: any) => {
                    resolve(evt.target.result);
                  };
                  getAllReq.onerror = () => resolve([]);
                } catch (err) {
                  resolve([]);
                } finally {
                  db.close();
                }
              };
              req.onerror = () => resolve([]);
            });

            if (records && records.length > 0) {
              diagnostics.indexedDBRecordsFound += records.length;
              console.log(`[Stremio Insights Diagnostics] Found ${records.length} records in "${dbName}.${storeName}"`);

              for (const rec of records) {
                if (rec && typeof rec === "object") {
                  if (rec._id && rec.name && rec.type) {
                    discoveredLibraryItems.push(rec);
                  } else if (rec.key === "library" || rec.id === "library") {
                    if (rec.value && Array.isArray(rec.value)) {
                      discoveredLibraryItems.push(...rec.value);
                    }
                  } else {
                    // Try to scan for library array or items inside the record
                    Object.values(rec).forEach((val: any) => {
                      if (Array.isArray(val)) {
                        val.forEach((item: any) => {
                          if (item && item._id && item.name && item.type) {
                            discoveredLibraryItems.push(item);
                          }
                        });
                      } else if (val && typeof val === "object" && val._id && val.name && val.type) {
                        discoveredLibraryItems.push(val);
                      }
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.error(`[Stremio Insights Diagnostics] Error reading store "${dbName}.${storeName}":`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[Stremio Insights Diagnostics] Error opening DB "${dbName}":`, err);
    }
  }

  diagnostics.libraryItemsDiscoveredInIndexedDB = discoveredLibraryItems.length;

  // 2. Discover from LocalStorage
  const localStorageItems: any[] = [];
  try {
    const libraryStr = localStorage.getItem("library");
    if (libraryStr) {
      const parsedLib = JSON.parse(libraryStr);
      if (Array.isArray(parsedLib)) {
        localStorageItems.push(...parsedLib);
      } else if (typeof parsedLib === "object") {
        Object.values(parsedLib).forEach((item: any) => {
          if (item && item._id && item.name && item.type) {
            localStorageItems.push(item);
          }
        });
      }
    }
  } catch (err) {
    console.error("[Stremio Insights Diagnostics] Error parsing library from localStorage:", err);
  }

  diagnostics.libraryItemsDiscoveredInLocalStorage = localStorageItems.length;

  // Combine discovered items (indexedDB + localStorage)
  const allDiscoveredItemsMap = new Map<string, any>();
  [...discoveredLibraryItems, ...localStorageItems].forEach((item) => {
    if (item && item._id && item.name && item.type) {
      allDiscoveredItemsMap.set(item._id, item);
    }
  });

  const uniqueDiscoveredItems = Array.from(allDiscoveredItemsMap.values());
  console.log(`[Stremio Insights Diagnostics] Unique Stremio library items: ${uniqueDiscoveredItems.length}`);

  // 3. Fallback: DOM Extraction of "Continue Watching" items
  const domExtractedItems = extractFromDOM();
  diagnostics.domExtractedCount = domExtractedItems.length;

  // 4. Merge results and convert to PlaybackEvents
  const finalPlaybackEventsMap = new Map<string, PlaybackEvent>();

  const convertLibraryItemToPlaybackEvent = (item: any): PlaybackEvent | null => {
    const state = item.state;
    if (!state || (!state.lastWatched && !state.timesWatched && !state.timeWatched)) {
      return null;
    }

    const imdb_id = item._id;
    const started_at = state.lastWatched || new Date().toISOString();
    const finished_at = state.lastWatched || new Date().toISOString();
    const duration = state.duration || 3600000;
    const time_watched = state.timeWatched || duration;
    const progress = duration > 0 ? Math.min(100, Math.round((time_watched / duration) * 100)) : 100;

    return {
      imdb_id,
      title: item.name,
      type: item.type || "movie",
      started_at,
      finished_at,
      progress,
      watch_count: state.timesWatched || 1,
      duration,
      time_watched,
      genres: item.genres || ["Historical"],
      year: state.lastWatched ? new Date(state.lastWatched).getFullYear() : undefined
    };
  };

  uniqueDiscoveredItems.forEach((item) => {
    const event = convertLibraryItemToPlaybackEvent(item);
    if (event) {
      finalPlaybackEventsMap.set(event.imdb_id, event);
    }
  });

  // Merge/override with DOM extracted items
  domExtractedItems.forEach((domItem) => {
    const existing = finalPlaybackEventsMap.get(domItem.imdb_id);
    if (existing) {
      existing.progress = domItem.progress ?? existing.progress;
      if (domItem.watch_count) existing.watch_count = domItem.watch_count;
    } else {
      finalPlaybackEventsMap.set(domItem.imdb_id, domItem);
    }
  });

  const finalEvents = Array.from(finalPlaybackEventsMap.values());
  console.log(`[Stremio Insights Diagnostics] Combined final events to sync: ${finalEvents.length}`);

  // 5. Store results in chrome.storage.local
  try {
    await chrome.storage.local.set({
      stremio_insights_synced_data: finalEvents,
      stremio_insights_sync_diagnostics: {
        ...diagnostics,
        eventsCount: finalEvents.length,
        lastSyncTime: new Date().toISOString()
      }
    });
    console.log("[Stremio Insights Diagnostics] Synced results saved to chrome.storage.local.");
  } catch (err) {
    console.error("[Stremio Insights Diagnostics] Error saving to chrome.storage.local:", err);
  }

  // 6. Push events to background worker (which updates IndexedDB)
  let syncedCount = 0;
  for (const event of finalEvents) {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: "ADD_PLAYBACK_EVENT",
          payload: event
        }, (res) => {
          if (res && res.success) {
            syncedCount++;
            resolve();
          } else {
            reject(new Error(res?.error || "Unknown response from SW"));
          }
        });
      });
    } catch (e) {
      console.error(`[Stremio Insights Diagnostics] Error sending event ${event.imdb_id} to SW:`, e);
    }
  }

  console.log(`[Stremio Insights Diagnostics] Synced ${syncedCount} records.`);
  return syncedCount;
}

/**
 * Sync active profile authKey to chrome.storage for seamless auto-auth
 */
function syncProfileAuthKey() {
  const profileStr = localStorage.getItem("profile");
  if (profileStr) {
    try {
      const profile = JSON.parse(profileStr);
      const authKey = profile?.auth?.key;
      if (authKey) {
        chrome.storage.local.set({ stremio_auth_key: authKey });
      }
    } catch (e) {
      console.error("[Stremio Insights] Error syncing profile key:", e);
    }
  }
}

/**
 * Attaches event listeners to the video element to track playback in real time
 */
function attachVideoListeners(video: HTMLVideoElement) {
  if (currentVideoElement === video) return;
  currentVideoElement = video;

  console.log("[Stremio Insights] New video element detected. Attaching listeners.");

  const onPlay = () => {
    const details = parsePlayerHash(window.location.hash);
    if (!details) return;

    // Get title from DOM if possible
    let title = "Unknown Title";
    const titleEl = document.querySelector(".player-title, .video-title, .meta-title");
    if (titleEl && titleEl.textContent) {
      title = titleEl.textContent.trim();
    }

    currentPlaySession = {
      imdb_id: details.imdb_id,
      title,
      type: details.type,
      season: details.season,
      episode: details.episode,
      started_at: new Date().toISOString(),
      lastProgressSent: 0
    };

    console.log("[Stremio Insights] Playback started:", currentPlaySession);
  };

  const onTimeUpdate = () => {
    if (!currentPlaySession || !video.duration) return;

    const currentTimeMs = video.currentTime * 1000;
    const durationMs = video.duration * 1000;
    const progress = Math.round((currentTimeMs / durationMs) * 100);

    // Save progress periodically (every 10%) or on major milestones
    if (progress >= currentPlaySession.lastProgressSent + 10) {
      currentPlaySession.lastProgressSent = progress;
      logPlaybackEvent(video, false);
    }
  };

  const onPauseOrEnded = () => {
    if (!currentPlaySession) return;
    logPlaybackEvent(video, true);
  };

  video.addEventListener("play", onPlay);
  video.addEventListener("timeupdate", onTimeUpdate);
  video.addEventListener("pause", onPauseOrEnded);
  video.addEventListener("ended", onPauseOrEnded);

  // If already playing, trigger initial session
  if (!video.paused) {
    onPlay();
  }
}

/**
 * Dispatches a playback event to the background Service Worker
 */
function logPlaybackEvent(video: HTMLVideoElement, isFinal: boolean) {
  if (!currentPlaySession) return;

  const currentTimeMs = video.currentTime * 1000;
  const durationMs = video.duration * 1000;
  const progress = durationMs > 0 ? Math.round((currentTimeMs / durationMs) * 100) : 100;

  const eventPayload: PlaybackEvent = {
    imdb_id: currentPlaySession.imdb_id,
    title: currentPlaySession.title,
    type: currentPlaySession.type,
    season: currentPlaySession.season,
    episode: currentPlaySession.episode,
    started_at: currentPlaySession.started_at,
    finished_at: new Date().toISOString(),
    progress,
    watch_count: isFinal && progress >= 80 ? 1 : 0, // count as a full watch if viewed at least 80%
    duration: durationMs,
    time_watched: currentTimeMs
  };

  chrome.runtime.sendMessage({
    type: "ADD_PLAYBACK_EVENT",
    payload: eventPayload
  });

  if (isFinal) {
    console.log("[Stremio Insights] Playback session finalized:", eventPayload);
    currentPlaySession = null;
  }
}

/**
 * Query stats and inject visual badges into card element
 */
async function injectBadgesToCard(card: HTMLElement, type: string, id: string) {
  // Use a unique hash of card element to avoid infinite processing loops
  const cardHash = `${id}-${card.offsetLeft}-${card.offsetTop}`;
  if (processedCardHashes.has(cardHash)) return;
  processedCardHashes.add(cardHash);

  chrome.runtime.sendMessage(
    { type: "GET_PLAYBACK_EVENTS" },
    (response) => {
      if (!response || !response.success || !response.events) return;

      const events: PlaybackEvent[] = response.events;
      const filtered = events.filter(e => e.imdb_id === id || e.imdb_id.startsWith(id + ":"));

      if (filtered.length === 0) return;

      // Calculate aggregates
      const watchCount = filtered.reduce((acc, e) => acc + (e.watch_count || 1), 0);
      const latest = filtered[0]; // newest first from SW
      const maxProgress = Math.max(...filtered.map(e => e.progress));

      // Check if badge already injected
      if (card.querySelector(".stremio-insights-badge")) return;

      // Find image poster wrapper or first child to inject badge container
      const targetContainer = card.querySelector(".poster-image, .poster, img")?.parentElement || card;

      const badgeDiv = document.createElement("div");
      badgeDiv.className = "stremio-insights-badge absolute bottom-2 left-2 right-2 bg-black/80 text-white rounded p-1 text-[10px] z-10 font-sans pointer-events-none border border-purple-500/30 flex flex-col gap-0.5 shadow-md";
      badgeDiv.innerHTML = `
        <div class="flex justify-between font-bold text-purple-400">
          <span>Watch count: ${watchCount}</span>
          <span>Progress: ${maxProgress}%</span>
        </div>
        <div class="text-[9px] text-gray-300">
          Last: ${formatBuenosAiresDate(latest.started_at)}
        </div>
      `;

      targetContainer.style.position = "relative";
      targetContainer.appendChild(badgeDiv);
    }
  );
}

/**
 * Scan DOM for cards and inject badges
 */
function scanAndInjectBadges() {
  const anchors = document.querySelectorAll("a[href*='#/detail/']");

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) return;

    // Format: #/detail/{type}/{id}
    const parts = href.split("/");
    if (parts.length >= 4) {
      const type = parts[2];
      const id = parts[3];

      // Inject badge to anchor card
      injectBadgesToCard(anchor as HTMLElement, type, id);
    }
  });
}

/**
 * Injects the beautiful slidable React drawer and toggle button
 */
function injectInsightsSidebar() {
  if (document.getElementById("stremio-insights-sidebar-wrapper")) return;

  // 1. Create floating action toggle button
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "stremio-insights-toggle-btn";
  toggleBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    <span>Insights</span>
  `;
  document.body.appendChild(toggleBtn);

  // 2. Create sidebar wrapper
  const sidebarWrapper = document.createElement("div");
  sidebarWrapper.id = "stremio-insights-sidebar-wrapper";
  sidebarWrapper.className = "stremio-insights-sidebar-wrapper";
  document.body.appendChild(sidebarWrapper);

  // 3. Mount React App inside sidebarWrapper
  const root = createRoot(sidebarWrapper);
  root.render(
    React.createElement(Dashboard)
  );

  // 4. Handle toggles
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebarWrapper.classList.toggle("open");
  });

  // Close sidebar on click outside
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      sidebarWrapper.classList.contains("open") &&
      !sidebarWrapper.contains(target) &&
      target !== toggleBtn &&
      !toggleBtn.contains(target)
    ) {
      sidebarWrapper.classList.remove("open");
    }
  });
}

/**
 * Handle custom fetch interception events from main world
 */
window.addEventListener("STREMIO_DATASTORE_PUT_INTERCEPTED", (event: any) => {
  const { request, response } = event.detail;
  console.log("[Stremio Insights] Intercepted datastore update:", request);

  // If the datastore was updated, let's refresh our local state and triggers badge re-evaluation
  processedCardHashes.clear();
  scanAndInjectBadges();
  syncProfileAuthKey();
});

// Debounce state to avoid excessive database syncs
let syncTimeout: any = null;
function debouncedSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    const hash = window.location.hash || "";
    if (
      hash.includes("continuewatching") ||
      hash.includes("board") ||
      hash === "" ||
      hash === "#/"
    ) {
      discoverAndSyncData().catch(err => {
        console.error("[Stremio Insights Diagnostics] Automatic debounced sync failed:", err);
      });
    }
  }, 2000);
}

// Single MutationObserver across the entire document
const observer = new MutationObserver(() => {
  mutationCount++;
  console.log(`[Stremio Insights Diagnostics] DOM mutation detected. Total mutations tracked: ${mutationCount}`);

  // 1. Detect player / video tag
  const video = document.querySelector("video") as HTMLVideoElement;
  if (video) {
    attachVideoListeners(video);
  }

  // 2. Scan and inject badges onto cards
  scanAndInjectBadges();

  // 3. Debounce automatic sync
  debouncedSync();
});

// Route changes and automatic triggers
function handleRouteSync() {
  const hash = window.location.hash || "";
  console.log("[Stremio Insights Diagnostics] Route change detected. Current hash:", hash);

  if (
    hash.includes("continuewatching") ||
    hash.includes("board") ||
    hash === "" ||
    hash === "#/"
  ) {
    setTimeout(() => {
      discoverAndSyncData().catch(err => {
        console.error("[Stremio Insights Diagnostics] Error during route sync:", err);
      });
    }, 1500);
  }
}

// Start observing on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  logInitialDiagnostics();

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  scanAndInjectBadges();
  syncProfileAuthKey();
  injectInsightsSidebar();

  // Route-based trigger
  handleRouteSync();
});

// Handle route transitions
window.addEventListener("hashchange", () => {
  processedCardHashes.clear();
  setTimeout(scanAndInjectBadges, 300);
  syncProfileAuthKey();

  // Route-based trigger
  handleRouteSync();
});

// Handle messages from Popup or Background worker (e.g., FORCE_RESCAN)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FORCE_RESCAN") {
    console.log("[Stremio Insights Diagnostics] FORCE_RESCAN requested by popup.");
    discoverAndSyncData()
      .then((count) => {
        sendResponse({ success: true, count });
      })
      .catch((err) => {
        console.error("[Stremio Insights Diagnostics] FORCE_RESCAN failed:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }
  return;
});

console.log("[Stremio Insights] Content Script successfully initialized.");
