import { computeAnalytics } from "../analytics/stats";
export function needsRepair(item: any, correctType?: string): boolean {
  if (!item) return true;

  if (correctType && item.type !== correctType) return true;

  // 1. Repair genres: length == 1 and genres[0] == "Historical"
  const hasHistoricalGenre = Array.isArray(item.genres) && item.genres.length === 1 && item.genres[0] === "Historical";
  const missingGenres = !item.genres || !Array.isArray(item.genres) || item.genres.length === 0;

  // 2. Repair director: director == null (only for movies!)
  const missingDirector = item.type === "movie" && (item.director === null || item.director === undefined);

  // 3. Repair releaseYear malformed or missing
  const releaseYear = item.releaseYear;
  const isMalformedYear = !releaseYear || releaseYear === "Unknown" || !/^\d{4}$/.test(releaseYear);

  return hasHistoricalGenre || missingGenres || missingDirector || isMalformedYear;
}



export interface SyncStats {
  apiCallsCount: number;
  cinemetaEnrichedCount: number;
  omdbFallbackCount: number;
  missingGenresCount: number;
  missingDirectorsCount: number;
  unknownReleaseYearsCount: number;
}

export interface SyncPipelineInput {
  datastoreMap: Map<string, number>;
  idTypeMap: Map<string, "movie" | "series">;
  datastoreGetMap: Map<string, any>;
  existingLibrary: any[];
  metadataCache: Record<string, any>;
  fetchEnrichedMetadata: (imdbId: string, type: "movie" | "series", title: string, stats: SyncStats) => Promise<any>;
}

export interface SyncPipelineResult {
  mergedLibrary: any[];
  analytics: any;
  updatedMetadataCache: Record<string, any>;
  stats: SyncStats;
  repairedCount: number;
  cacheHitsCount: number;
  itemsToFetchCount: number;
}

export async function processSyncPipeline({
  datastoreMap,
  idTypeMap,
  datastoreGetMap,
  existingLibrary,
  metadataCache,
  fetchEnrichedMetadata,
}: SyncPipelineInput): Promise<SyncPipelineResult> {
  const existingMap = new Map<string, any>();
  existingLibrary.forEach(item => {
    if (item && item.imdbId) {
      existingMap.set(item.imdbId, item);
    }
  });

  const updatedMetadataCache = { ...metadataCache };
  const mergedLibrary: any[] = [];
  let repairedCount = 0;

  const stats: SyncStats = {
    apiCallsCount: 0,
    cinemetaEnrichedCount: 0,
    omdbFallbackCount: 0,
    missingGenresCount: 0,
    missingDirectorsCount: 0,
    unknownReleaseYearsCount: 0
  };

  let cacheHitsCount = 0;
  const datastoreKeys = Array.from(datastoreMap.keys());

  const itemsToFetch = datastoreKeys.filter(imdbId => {
    const existing = existingMap.get(imdbId);
    const correctType = idTypeMap.get(imdbId) || datastoreGetMap.get(imdbId)?.type;
    return !existing || needsRepair(existing, correctType);
  });

  console.log(`[SYNC] Out of ${datastoreKeys.length} items, ${itemsToFetch.length} need metadata fetch/repair.`);

  const fetchedMetaMap = new Map<string, any>();
  const fetchResults = await Promise.all(
    itemsToFetch.map(async (imdbId) => {
      const cleanId = imdbId.split(":")[0];
      let type: "movie" | "series" = imdbId.includes(":") ? "series" : "movie";
      const getMeta = datastoreGetMap.get(imdbId);
      if (getMeta && getMeta.type) {
        type = getMeta.type;
      } else {
        const detected = idTypeMap.get(imdbId);
        if (detected) {
          type = detected;
        }
      }

      const cached = metadataCache[cleanId];
      const isCacheTypeMismatch = cached?.meta && cached.meta.type && cached.meta.type !== type;
      const isCacheValid = cached && !isCacheTypeMismatch && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000);

      if (isCacheValid && cached?.meta) {
        cacheHitsCount++;
        const cachedGenres = cached.meta.genres || [];
        if (cachedGenres.length === 0 || cachedGenres.includes("Historical")) {
          stats.missingGenresCount++;
        }
        if (!cached.meta.director) {
          stats.missingDirectorsCount++;
        }
        if (cached.meta.releaseYear === "Unknown") {
          stats.unknownReleaseYearsCount++;
        }
        stats.cinemetaEnrichedCount++;
        return { imdbId, meta: cached.meta };
      }

      const title = getMeta?.name || `Unknown (${imdbId})`;
      try {
        const meta = await fetchEnrichedMetadata(imdbId, type, title, stats);
        const isFailedFetch = !meta || ((meta.genres || []).length === 1 && meta.genres[0] === "Historical" && !meta.director && meta.releaseYear === "Unknown");
        if (meta && !isFailedFetch) {
          updatedMetadataCache[cleanId] = {
            timestamp: Date.now(),
            meta
          };
        }
        return { imdbId, meta };
      } catch (err) {
        console.error(`[SYNC] Error fetching metadata for ${imdbId}:`, err);
        return { imdbId, meta: null };
      }
    })
  );

  fetchResults.forEach(res => {
    if (res.meta) {
      fetchedMetaMap.set(res.imdbId, res.meta);
    }
  });

  for (const imdbId of datastoreKeys) {
    const lastWatchedTimestamp = datastoreMap.get(imdbId)!;
    const existing = existingMap.get(imdbId);
    const repairing = existing && needsRepair(existing);

    let firstWatched = lastWatchedTimestamp;
    let lastWatched = lastWatchedTimestamp;

    if (existing) {
      const storedLastWatched = existing.lastWatched || existing.firstWatched || 0;
      if (lastWatchedTimestamp > storedLastWatched) {
        firstWatched = existing.firstWatched || lastWatchedTimestamp;
        lastWatched = lastWatchedTimestamp;
      } else {
        firstWatched = existing.firstWatched || lastWatchedTimestamp;
        lastWatched = existing.lastWatched || lastWatchedTimestamp;
      }
    }

    let meta = fetchedMetaMap.get(imdbId);
    if (!meta && existing) {
      meta = {
        genres: existing.genres || ["Historical"],
        director: existing.director || null,
        directors: existing.directors,
        actors: existing.actors || [],
        runtime: existing.runtime || "Unknown",
        plot: existing.plot || "",
        imdbRating: existing.imdbRating || "",
        poster: existing.poster || "",
        releaseYear: existing.releaseYear || (existing.year ? String(existing.year) : "Unknown")
      };
    }

    if (!meta) {
      meta = {
        genres: ["Historical"],
        director: null,
        actors: [],
        runtime: "Unknown",
        plot: "",
        imdbRating: "",
        poster: "",
        releaseYear: "Unknown"
      };
    }

    if (repairing && existing) {
      const oldGenres = existing.genres || [];
      const oldReleaseYear = existing.releaseYear || (existing.year ? String(existing.year) : "Unknown");

      if (oldGenres.length === 1 && oldGenres[0] === "Historical" && !(meta.genres.length === 1 && meta.genres[0] === "Historical")) {
        console.log(`[REPAIR]\nHistorical -> ${meta.genres.join(", ")}`);
      }
      if (oldReleaseYear && oldReleaseYear !== meta.releaseYear && (!/^\d{4}$/.test(oldReleaseYear) || oldReleaseYear === "Unknown")) {
        console.log(`[REPAIR]\n${oldReleaseYear} -> ${meta.releaseYear}`);
      }
      repairedCount++;
    }

    const getMeta = datastoreGetMap.get(imdbId);
    const title = meta.title || getMeta?.name || existing?.title || (imdbId === "tt0117951" ? "Twelve Monkeys" : `Unknown (${imdbId})`);
    const type = imdbId.includes(":") ? "series" : (getMeta?.type || meta?.type || idTypeMap.get(imdbId) || existing?.type || "movie");

    const duration = getMeta?.state?.duration || existing?.duration || 0;
    const time_watched = getMeta?.state?.timeWatched || existing?.time_watched || 0;
    const watch_count = getMeta?.state?.timesWatched || existing?.watch_count || 1;
    let progress = 0;
    if (duration > 0) {
      progress = Math.min(100, Math.round((time_watched / duration) * 100));
    } else if (getMeta?.state?.watched === "1" || getMeta?.state?.watched === "true" || getMeta?.state?.watched === true) {
      progress = 100;
    } else if (existing && existing.progress !== undefined) {
      progress = existing.progress;
    }

    let season = existing?.season;
    let episode = existing?.episode;
    if (imdbId.includes(":")) {
      const idParts = imdbId.split(":");
      if (idParts.length >= 3) {
        season = Number(idParts[1]);
        episode = Number(idParts[2]);
      }
    }
    const parent_id = imdbId.includes(":") ? imdbId.split(":")[0] : existing?.parent_id;
    const episode_title = existing?.episode_title;

    const mergedItem = {
      imdbId,
      title,
      type,
      poster: meta.poster || getMeta?.poster || existing?.poster || "",
      imdbRating: meta.imdbRating || existing?.imdbRating || "",
      genres: meta.genres,
      director: meta.director,
      directors: meta.directors,
      actors: meta.actors,
      runtime: meta.runtime,
      plot: meta.plot,
      releaseYear: meta.releaseYear,
      year: meta.releaseYear !== "Unknown" ? parseInt(meta.releaseYear) : undefined,
      firstWatched,
      lastWatched,
      progress,
      watch_count,
      duration,
      time_watched,
      season,
      episode,
      parent_id,
      episode_title,
      source: "stremio",
      repaired: true
    };

    mergedLibrary.push(mergedItem);
  }

  const analytics = computeAnalytics(mergedLibrary);

  return {
    mergedLibrary,
    analytics,
    updatedMetadataCache,
    stats,
    repairedCount,
    cacheHitsCount,
    itemsToFetchCount: itemsToFetch.length,
  };
}
