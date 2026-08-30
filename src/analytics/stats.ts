import { PlaybackEvent, WatchStats } from "../types";
import { normalizeTimestamp } from "../utils/date";
import { HEATMAP_MONTHS_COUNT, HEATMAP_DAYS_COUNT } from "../utils/constants";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const getWatchTime = (e: PlaybackEvent) => {
  if (e.lastWatched) return normalizeTimestamp(e.lastWatched);
  return normalizeTimestamp(e.finished_at || e.started_at);
};

export const getFirstWatchTime = (e: PlaybackEvent) => {
  if (e.firstWatched) return normalizeTimestamp(e.firstWatched);
  return normalizeTimestamp(e.started_at);
};

export interface AnalyticsSummary extends WatchStats {
  mostWatchedYear: number;
  timeline: Record<string, PlaybackEvent[]>;
  recentlyWatched: PlaybackEvent[];
  avgImdbRating: string;
  moviesPerMonth: Record<string, number>;
  heatmap: { month: number; day: number; count: number }[];
  topDecades: { decade: string; count: number }[];
  topGenres: { name: string; count: number }[];
  topDirectors: { name: string; count: number }[];
  topYears: { name: string; count: number }[];
  mostWatched: { title: string; count: number; type: string }[];
}

export function computeAnalytics(library: PlaybackEvent[]): AnalyticsSummary {
  let totalMovies = 0;
  let totalSeries = 0;
  let totalWatchCount = 0;
  let estimatedWatchTime = 0;
  let ratedSum = 0;
  let ratedCount = 0;

  const genreCounts: Record<string, number> = {};
  const directorCounts: Record<string, number> = {};
  const yearCounts: Record<string, number> = {};
  const decadeCounts: Record<string, number> = {};
  const libraryYearCounts: Record<number, number> = {};
  const titleCounts: Record<string, { count: number; type: string }> = {};
  const moviesPerMonth: Record<string, number> = {};

  const heatmapGrid: Record<string, number> = {};
  for (let m = 1; m <= HEATMAP_MONTHS_COUNT; m++) {
    for (let d = 1; d <= HEATMAP_DAYS_COUNT; d++) {
      heatmapGrid[`${m}-${d}`] = 0;
    }
  }

  const currentYear = new Date().getFullYear();
  const len = library.length;
  const enriched: { item: PlaybackEvent; watchTime: number; date: Date | null; dateValid: boolean }[] = new Array(len);

  let minItem: PlaybackEvent | null = null;
  let minTime = Infinity;

  for (let i = 0; i < len; i++) {
    const item = library[i];

    if (item.type === "movie") {
      totalMovies++;
    } else if (item.type === "series") {
      totalSeries++;
    }

    const watchCount = item.watch_count || 1;
    totalWatchCount += watchCount;
    estimatedWatchTime += (item.time_watched || 0);

    if (item.imdbRating) {
      const rating = parseFloat(item.imdbRating);
      if (!isNaN(rating)) {
        ratedSum += rating;
        ratedCount++;
      }
    }

    const yrStr = item.releaseYear || (item.year ? String(item.year) : "");
    if (yrStr) {
      const m = yrStr.match(/\d{4}/);
      if (m) {
        const yr = Number(m[0]);
        libraryYearCounts[yr] = (libraryYearCounts[yr] || 0) + 1;
        yearCounts[yr] = (yearCounts[yr] || 0) + 1;
        const decade = `${Math.floor(yr / 10) * 10}s`;
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
      }
    }

    if (item.genres) {
      for (let j = 0; j < item.genres.length; j++) {
        const g = item.genres[j];
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }

    if (item.directors && item.directors.length > 0) {
      for (let j = 0; j < item.directors.length; j++) {
        const d = item.directors[j];
        directorCounts[d] = (directorCounts[d] || 0) + 1;
      }
    } else if (item.director) {
      directorCounts[item.director] = (directorCounts[item.director] || 0) + 1;
    }

    const titleKey = item.title;
    const existingTitle = titleCounts[titleKey];
    if (existingTitle) {
      existingTitle.count += watchCount;
    } else {
      titleCounts[titleKey] = { count: watchCount, type: item.type };
    }

    const currFirstTime = getFirstWatchTime(item);
    if (currFirstTime < minTime) {
      minTime = currFirstTime;
      minItem = item;
    }

    const watchTime = getWatchTime(item);
    let date: Date | null = null;
    let dateValid = false;
    if (watchTime) {
      const d = new Date(watchTime);
      if (!isNaN(d.getTime())) {
        date = d;
        dateValid = true;

        if (item.type === "movie") {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          moviesPerMonth[key] = (moviesPerMonth[key] || 0) + 1;
        }

        if (d.getFullYear() === currentYear) {
          const month = d.getMonth() + 1;
          const day = d.getDate();
          heatmapGrid[`${month}-${day}`] = (heatmapGrid[`${month}-${day}`] || 0) + 1;
        }
      }
    }

    enriched[i] = { item, watchTime, date, dateValid };
  }

  // Sort enriched by precomputed watchTime descending
  enriched.sort((a, b) => b.watchTime - a.watchTime);

  const stats: WatchStats = {
    totalMovies,
    totalSeries,
    totalWatchCount,
    estimatedWatchTime,
    favoriteGenres: [],
    favoriteYears: [],
    favoriteDirectors: [],
    lastWatched: len > 0 ? enriched[0].item : null,
    firstRecorded: len > 0 ? minItem : null,
  };

  let mostWatchedYear = 0;
  let maxYearCount = 0;
  Object.entries(libraryYearCounts).forEach(([yr, count]) => {
    if (count > maxYearCount) {
      maxYearCount = count;
      mostWatchedYear = Number(yr);
    }
  });

  const timeline: Record<string, PlaybackEvent[]> = {};
  for (let i = 0; i < len; i++) {
    const entry = enriched[i];
    if (entry.dateValid && entry.date) {
      const monthYear = `${MONTHS[entry.date.getMonth()]} ${entry.date.getFullYear()}`;
      if (!timeline[monthYear]) {
        timeline[monthYear] = [];
      }
      timeline[monthYear].push(entry.item);
    }
  }

  const recentlyWatched = enriched.slice(0, 10).map(x => x.item);

  const avgImdbRating = ratedCount > 0
    ? (ratedSum / ratedCount).toFixed(1)
    : "0.0";

  const heatmap: { month: number; day: number; count: number }[] = [];
  Object.entries(heatmapGrid).forEach(([key, count]) => {
    const [month, day] = key.split("-").map(Number);
    heatmap.push({ month, day, count });
  });

  const topDecades = Object.entries(decadeCounts)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.count - a.count);

  const sortMapToArray = (counts: Record<string, number>) =>
    Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  const topGenresList = sortMapToArray(genreCounts);
  const topDirectorsList = sortMapToArray(directorCounts);
  const topYearsList = sortMapToArray(yearCounts);

  stats.favoriteGenres = topGenresList.slice(0, 3).map(g => g.name);
  stats.favoriteDirectors = topDirectorsList.slice(0, 3).map(d => d.name);
  stats.favoriteYears = topYearsList.slice(0, 3).map(y => Number(y.name));

  const mostWatchedList = Object.entries(titleCounts)
    .map(([title, info]) => ({ title, count: info.count, type: info.type }))
    .sort((a, b) => b.count - a.count);

  return {
    ...stats,
    mostWatchedYear,
    timeline,
    recentlyWatched,
    avgImdbRating,
    moviesPerMonth,
    heatmap,
    topDecades,
    topGenres: topGenresList,
    topDirectors: topDirectorsList,
    topYears: topYearsList,
    mostWatched: mostWatchedList
  };
}

export function groupEventsIntoTimeline(events: PlaybackEvent[]): Record<string, Record<string, PlaybackEvent[]>> {
  const sorted = [...events].sort((a, b) => getWatchTime(b) - getWatchTime(a));
  const timeline: Record<string, Record<string, PlaybackEvent[]>> = {};

  for (const event of sorted) {
    const ts = getWatchTime(event);
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;

    const year = String(d.getFullYear());
    const month = MONTHS[d.getMonth()];

    if (!timeline[year]) {
      timeline[year] = {};
    }
    if (!timeline[year][month]) {
      timeline[year][month] = [];
    }
    timeline[year][month].push(event);
  }

  return timeline;
}
