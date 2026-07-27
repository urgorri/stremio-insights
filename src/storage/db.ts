import { openDB, DBSchema, IDBPDatabase } from "idb";
import { PlaybackEvent } from "../types";

export interface MetadataCache {
  imdb_id: string;
  title: string;
  type: "movie" | "series";
  genres?: string[];
  year?: number;
  directors?: string[];
  poster?: string;
  lastUpdated: string;
}

interface StremioInsightsDB extends DBSchema {
  playback_events: {
    key: number;
    value: PlaybackEvent;
    indexes: {
      by_imdb_id: string;
      by_started_at: string;
    };
  };
  metadata_cache: {
    key: string;
    value: MetadataCache;
  };
}

const DB_NAME = "stremio_insights_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StremioInsightsDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<StremioInsightsDB>> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<StremioInsightsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Playback events store
      if (!db.objectStoreNames.contains("playback_events")) {
        const eventStore = db.createObjectStore("playback_events", {
          keyPath: "id",
          autoIncrement: true,
        });
        eventStore.createIndex("by_imdb_id", "imdb_id");
        eventStore.createIndex("by_started_at", "started_at");
      }

      // Metadata cache store
      if (!db.objectStoreNames.contains("metadata_cache")) {
        db.createObjectStore("metadata_cache", {
          keyPath: "imdb_id",
        });
      }
    },
  });

  return dbPromise;
}

/**
 * Storage API functions
 */

export async function addPlaybackEvent(event: PlaybackEvent): Promise<number> {
  const db = await getDB();
  return db.add("playback_events", event);
}

export async function updatePlaybackEvent(event: PlaybackEvent): Promise<number> {
  const db = await getDB();
  return db.put("playback_events", event);
}

export async function getAllPlaybackEvents(): Promise<PlaybackEvent[]> {
  const db = await getDB();
  const events = await db.getAllFromIndex("playback_events", "by_started_at");
  // Return sorted descending (newest first)
  return events.reverse();
}

export async function getPlaybackEventsByImdbId(imdb_id: string): Promise<PlaybackEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex("playback_events", "by_imdb_id", imdb_id);
}

export async function clearAllPlaybackEvents(): Promise<void> {
  const db = await getDB();
  await db.clear("playback_events");
}

export async function getMetadata(imdb_id: string): Promise<MetadataCache | undefined> {
  const db = await getDB();
  return db.get("metadata_cache", imdb_id);
}

export async function saveMetadata(metadata: MetadataCache): Promise<string> {
  const db = await getDB();
  return db.put("metadata_cache", metadata);
}

export async function getAllMetadata(): Promise<MetadataCache[]> {
  const db = await getDB();
  return db.getAll("metadata_cache");
}

export async function clearAllMetadata(): Promise<void> {
  const db = await getDB();
  await db.clear("metadata_cache");
}
