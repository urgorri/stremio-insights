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

// Single MutationObserver across the entire document
const observer = new MutationObserver(() => {
  // 1. Detect player / video tag
  const video = document.querySelector("video") as HTMLVideoElement;
  if (video) {
    attachVideoListeners(video);
  }

  // 2. Scan and inject badges onto cards
  scanAndInjectBadges();
});

// Start observing on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  scanAndInjectBadges();
  syncProfileAuthKey();
  injectInsightsSidebar();
});

// Handle route transitions
window.addEventListener("hashchange", () => {
  processedCardHashes.clear();
  setTimeout(scanAndInjectBadges, 300);
  syncProfileAuthKey();
});

console.log("[Stremio Insights] Content Script successfully initialized.");
