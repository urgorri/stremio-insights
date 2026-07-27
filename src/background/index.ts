import {
  addPlaybackEvent,
  updatePlaybackEvent,
  getAllPlaybackEvents,
  getPlaybackEventsByImdbId,
  clearAllPlaybackEvents,
  saveMetadata,
  getMetadata,
  getAllMetadata,
  clearAllMetadata
} from "../storage/db";
import { PlaybackEvent, StremioLibraryItem } from "../types";
import { computeAnalytics } from "../analytics/stats";
import { convertToCSV, convertToJSON } from "../utils/export";
import { normalizeTimestamp, mergeWatchHistory } from "../utils/date";

// On install, we initialize state and set standard defaults
chrome.runtime.onInstalled.addListener(() => {
  console.log("Stremio Insights Service Worker Installed.");
});

/**
 * Broadcasts a message to all open components (e.g. popup or sidebar)
 */
function broadcastMessage(message: any) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Suppress error when no receiver/popup is currently open
  });
}

// Listener for messages from Content Script or UI panels
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleMessage = async () => {
    try {
      switch (message.type) {
        case "ADD_PLAYBACK_EVENT": {
          const event: PlaybackEvent = message.payload;

          // Let's first check if an identical playback event (same imdb_id and extremely close started_at) exists
          // If it exists, we UPDATE it (upsert) to capture latest progress, finished_at, and watch counts!
          const existing = await getPlaybackEventsByImdbId(event.imdb_id);
          const existingEvent = existing.find(e => {
            const timeDiff = Math.abs(new Date(e.started_at).getTime() - new Date(event.started_at).getTime());
            return timeDiff < 60000; // Less than 1 minute difference means same play session
          });

          if (existingEvent) {
            existingEvent.progress = event.progress;
            existingEvent.finished_at = event.finished_at;
            existingEvent.time_watched = event.time_watched;
            existingEvent.watch_count = Math.max(existingEvent.watch_count || 0, event.watch_count || 0);
            await updatePlaybackEvent(existingEvent);
            console.log("[Stremio Insights SW] Updated existing playback session:", existingEvent);
          } else {
            await addPlaybackEvent(event);
            console.log("[Stremio Insights SW] Logged new playback session:", event);
          }

          // Also cache metadata if provided
          if (event.genres || event.directors || event.year) {
            await saveMetadata({
              imdb_id: event.imdb_id.split(":")[0], // use parent id or base imdb id for metadata cache
              title: event.title,
              type: event.type,
              genres: event.genres,
              year: event.year,
              directors: event.directors,
              lastUpdated: new Date().toISOString()
            });
          }

          // Broadcast that synchronization occurred
          broadcastMessage({ type: "DATA_SYNCHRONIZED" });

          return { success: true };
        }

        case "GET_PLAYBACK_EVENTS": {
          const events = await getAllPlaybackEvents();
          return { success: true, events };
        }

        case "CLEAR_HISTORY": {
          await clearAllPlaybackEvents();
          await clearAllMetadata();
          return { success: true };
        }

        case "GET_STATS": {
          const events = await getAllPlaybackEvents();
          const stats = computeAnalytics(events);
          return { success: true, stats };
        }

        case "EXPORT_DATA": {
          const format = message.payload?.format || "json";
          const events = await getAllPlaybackEvents();
          const data = format === "csv" ? convertToCSV(events) : convertToJSON(events);
          return { success: true, data };
        }

        case "STREMIO_SYNC_REQUEST": {
          const authKey = message.payload?.authKey;
          if (!authKey) {
            return { success: false, error: "Missing Stremio authKey" };
          }
          const importedCount = await performStremioRecoverySync(authKey);
          // Broadcast after recovery sync
          broadcastMessage({ type: "DATA_SYNCHRONIZED" });
          return { success: true, importedCount };
        }

        case "GET_METADATA_CACHE": {
          const imdbId = message.payload?.imdbId;
          if (!imdbId) return { success: false, error: "Missing IMDb ID" };
          const meta = await getMetadata(imdbId);
          return { success: true, meta };
        }

        case "SAVE_METADATA_CACHE": {
          const meta = message.payload;
          if (!meta || !meta.imdb_id) return { success: false, error: "Invalid metadata payload" };
          await saveMetadata(meta);
          return { success: true };
        }

        case "GET_ALL_METADATA": {
          const allMeta = await getAllMetadata();
          return { success: true, metadata: allMeta };
        }

        default:
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    } catch (error: any) {
      console.error("Error handling service worker message:", error);
      return { success: false, error: error.message };
    }
  };

  // Convert async handleMessage to sendResponse wrapper in Chrome Extensions MV3
  handleMessage().then(sendResponse);
  return true; // Keep message channel open
});

/**
 * Recovers previous watch history from api.strem.io datastore API.
 */
async function performStremioRecoverySync(authKey: string): Promise<number> {
  console.log("[Stremio Insights SW] Fetching datastoreMeta to extract authoritative timestamps...");
  const metaResponse = await fetch("https://api.strem.io/api/datastoreMeta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, collection: "libraryItem" })
  });

  const metaMap = new Map<string, number>();
  if (metaResponse.ok) {
    const metaJson = await metaResponse.json();
    if (metaJson && Array.isArray(metaJson.result)) {
      for (const [id, timestamp] of metaJson.result) {
        if (id && typeof timestamp === "number") {
          metaMap.set(id, timestamp);
        }
      }
    }
  } else {
    console.error("[Stremio Insights SW] Failed to fetch datastoreMeta:", metaResponse.statusText);
  }

  console.log("[Stremio Insights SW] Fetching full library details from datastoreGet...");
  const response = await fetch("https://api.strem.io/api/datastoreGet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, collection: "library" })
  });

  if (!response.ok) {
    throw new Error(`Failed to contact Stremio datastore API: ${response.statusText}`);
  }

  const jsonResponse = await response.json();
  const libraryItems: StremioLibraryItem[] = jsonResponse.result || [];

  // Read all existing local events to allow repairs/migration and merge matching items
  const existingEvents = await getAllPlaybackEvents();
  const existingEventsMap = new Map<string, PlaybackEvent>();
  for (const e of existingEvents) {
    existingEventsMap.set(e.imdb_id, e);
  }

  // Task 8: Migration & Repair Logic
  let repairedCount = 0;
  for (const e of existingEvents) {
    // Detect source === "stremio" (or missing source which indicates historical stremio imports)
    if (e.source === "stremio" || !e.source) {
      const stremioTimestamp = metaMap.get(e.imdb_id);
      if (stremioTimestamp) {
        const previousLastWatched = e.lastWatched || normalizeTimestamp(e.finished_at || e.started_at);

        e.firstWatched = stremioTimestamp;
        e.lastWatched = stremioTimestamp;
        e.started_at = new Date(stremioTimestamp).toISOString();
        e.finished_at = new Date(stremioTimestamp).toISOString();
        e.source = "stremio";
        e.imdbId = e.imdb_id;

        // Task 9: Exact logging format requirement
        console.log(`[SYNC]\n${e.imdb_id}\npreviousLastWatched=${previousLastWatched}\nstremioLastWatched=${stremioTimestamp}\nfinalLastWatched=${stremioTimestamp}`);

        await updatePlaybackEvent(e);
        existingEventsMap.set(e.imdb_id, e); // Update in memory map
        repairedCount++;
      }
    }
  }
  console.log(`[Stremio Insights SW] Successfully repaired/migrated ${repairedCount} existing records from datastoreMeta.`);

  let importedCount = 0;

  for (const item of libraryItems) {
    // Only import items with a watched history
    const state = item.state;
    if (state && ((state.timesWatched && state.timesWatched > 0) || state.lastWatched)) {
      const imdb_id = item._id;
      const stremioTimestamp = metaMap.get(imdb_id);
      const rawTimestamp = stremioTimestamp || (state.lastWatched ? normalizeTimestamp(state.lastWatched) : 0);

      // Never use Date.now() for Stremio history imports
      if (rawTimestamp === 0) {
        console.warn(`[Stremio Insights SW] Skipping ${imdb_id} - no valid watch timestamp found.`);
        continue;
      }

      const existing = existingEventsMap.get(imdb_id);

      // Build duration & time watched estimates
      const duration = state.duration || 3600000; // default 1 hour
      const time_watched = state.timeWatched || duration;
      const progress = duration > 0 ? Math.min(100, Math.round((time_watched / duration) * 100)) : 100;

      if (!existing) {
        const mergedTimes = mergeWatchHistory(undefined, rawTimestamp);

        const event: PlaybackEvent = {
          imdb_id,
          imdbId: imdb_id,
          title: item.name,
          type: item.type || "movie",
          started_at: new Date(mergedTimes.firstWatched).toISOString(),
          finished_at: new Date(mergedTimes.lastWatched).toISOString(),
          progress,
          watch_count: state.timesWatched || 1,
          duration,
          time_watched,
          genres: item.genres || ["Historical"],
          year: new Date(mergedTimes.lastWatched).getFullYear(),
          firstWatched: mergedTimes.firstWatched,
          lastWatched: mergedTimes.lastWatched,
          source: "stremio"
        };

        console.log(`[SYNC]\n${imdb_id}\npreviousLastWatched=0\nstremioLastWatched=${rawTimestamp}\nfinalLastWatched=${mergedTimes.lastWatched}`);

        await addPlaybackEvent(event);
        importedCount++;
      } else {
        // Existing record merging
        const mergedTimes = mergeWatchHistory(existing, rawTimestamp);
        const previousLastWatched = existing.lastWatched || normalizeTimestamp(existing.finished_at || existing.started_at);

        existing.firstWatched = mergedTimes.firstWatched;
        existing.lastWatched = mergedTimes.lastWatched;
        existing.started_at = new Date(mergedTimes.firstWatched).toISOString();
        existing.finished_at = new Date(mergedTimes.lastWatched).toISOString();
        existing.source = "stremio";
        existing.imdbId = imdb_id;
        existing.progress = Math.max(existing.progress, progress);
        existing.watch_count = Math.max(existing.watch_count || 0, state.timesWatched || 1);

        console.log(`[SYNC]\n${imdb_id}\npreviousLastWatched=${previousLastWatched}\nstremioLastWatched=${rawTimestamp}\nfinalLastWatched=${mergedTimes.lastWatched}`);

        await updatePlaybackEvent(existing);
      }
    }
  }

  return importedCount;
}
