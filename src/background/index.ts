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

// On install, we initialize state and set standard defaults
chrome.runtime.onInstalled.addListener(() => {
  console.log("Stremio Insights Service Worker Installed.");
});

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

  let importedCount = 0;

  for (const item of libraryItems) {
    // Only import items with a watched history
    const state = item.state;
    if (state && (state.timesWatched && state.timesWatched > 0 || state.lastWatched)) {
      const imdb_id = item._id;
      const started_at = state.lastWatched || new Date().toISOString();
      const finished_at = state.lastWatched || new Date().toISOString();

      // Check if this item is already recorded to avoid duplicates
      const existing = await getPlaybackEventsByImdbId(imdb_id);
      const isRecorded = existing.some(e => {
        const diff = Math.abs(new Date(e.started_at).getTime() - new Date(started_at).getTime());
        return diff < 120000; // 2 minutes
      });

      if (!isRecorded) {
        // Build duration & time watched estimates
        const duration = state.duration || 3600000; // default 1 hour
        const time_watched = state.timeWatched || duration;
        const progress = duration > 0 ? Math.min(100, Math.round((time_watched / duration) * 100)) : 100;

        const event: PlaybackEvent = {
          imdb_id,
          title: item.name,
          type: item.type || "movie",
          started_at,
          finished_at,
          progress,
          watch_count: state.timesWatched || 1,
          duration,
          time_watched,
          // Placeholder genres or metadata can be updated by active crawling later
          genres: ["Historical"],
          year: state.lastWatched ? new Date(state.lastWatched).getFullYear() : undefined
        };

        await addPlaybackEvent(event);
        importedCount++;
      }
    }
  }

  return importedCount;
}
