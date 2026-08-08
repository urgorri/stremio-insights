import { PlaybackEvent, WatchStats } from "../types";
import { normalizeTimestamp } from "../utils/date";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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
  const movies = library.filter(item => item.type === "movie");
  const series = library.filter(item => item.type === "series");

  // Basic WatchStats fields
  const stats: WatchStats = {
    totalMovies: movies.length,
    totalSeries: series.length,
    totalWatchCount: 0,
    estimatedWatchTime: 0,
    favoriteGenres: [],
    favoriteYears: [],
    favoriteDirectors: [],
    lastWatched: null,
    firstRecorded: null,
  };

  const genreCounts: Record<string, number> = {};
  const directorCounts: Record<string, number> = {};
  const yearCounts: Record<string, number> = {};
  const titleCounts: Record<string, { count: number; type: string }> = {};

  // Consolidate variables for single pass
  const libraryYearCounts: Record<number, number> = {};
  const moviesPerMonth: Record<string, number> = {};
  const decadeCounts: Record<string, number> = {};

  const heatmapGrid: Record<string, number> = {};
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 31; d++) {
      heatmapGrid[`${m}-${d}`] = 0;
    }
  }
  const currentYear = new Date().getFullYear();

  let ratedItemsCount = 0;
  let ratedItemsSum = 0;

  // Resolve watch timestamp helper, preferring lastWatched, falling back to finished_at or started_at
  const getWatchTime = (e: PlaybackEvent) => {
    if (e.lastWatched) return normalizeTimestamp(e.lastWatched);
    return normalizeTimestamp(e.finished_at || e.started_at);
  };

  const getFirstWatchTime = (e: PlaybackEvent) => {
    if (e.firstWatched) return normalizeTimestamp(e.firstWatched);
    return normalizeTimestamp(e.started_at);
  };

  // Find firstRecorded by finding the minimum first watch time
  stats.firstRecorded = library.length > 0
    ? library.reduce((min, curr) => getFirstWatchTime(curr) < getFirstWatchTime(min) ? curr : min)
    : null;

  library.forEach(item => {
    stats.totalWatchCount += (item.watch_count || 1);
    stats.estimatedWatchTime += (item.time_watched || 0);

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
      item.genres.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }

    if (item.directors && item.directors.length > 0) {
      item.directors.forEach(d => {
        directorCounts[d] = (directorCounts[d] || 0) + 1;
      });
    } else if (item.director) {
      directorCounts[item.director] = (directorCounts[item.director] || 0) + 1;
    }

    const titleKey = item.title;
    if (!titleCounts[titleKey]) {
      titleCounts[titleKey] = { count: 0, type: item.type };
    }
    titleCounts[titleKey].count += (item.watch_count || 1);

    // Average IMDb rating
    if (item.imdbRating) {
        const rating = parseFloat(item.imdbRating);
        if (!isNaN(rating)) {
            ratedItemsSum += rating;
            ratedItemsCount += 1;
        }
    }

    // Process timestamp-based data (movies per month, heatmap)
    const ts = getWatchTime(item);
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
          // Movies watched per month
          if (item.type === "movie") {
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              moviesPerMonth[key] = (moviesPerMonth[key] || 0) + 1;
          }

          // Heatmap
          if (d.getFullYear() === currentYear) {
              const month = d.getMonth() + 1;
              const day = d.getDate();
              heatmapGrid[`${month}-${day}`] = (heatmapGrid[`${month}-${day}`] || 0) + 1;
          }
      }
    }
  });

  // Sort by watch time to find lastWatched
  const sortedByLast = library
    .slice()
    .sort((a, b) => getWatchTime(a) - getWatchTime(b));
  stats.lastWatched = sortedByLast[sortedByLast.length - 1] || null;

  let mostWatchedYear = 0;
  let maxYearCount = 0;
  Object.entries(libraryYearCounts).forEach(([yr, count]) => {
    if (count > maxYearCount) {
      maxYearCount = count;
      mostWatchedYear = Number(yr);
    }
  });

  // Timeline (using watch time)
  const timeline: Record<string, PlaybackEvent[]> = {};
  // Reuse sorted array (descending)
  for (let i = sortedByLast.length - 1; i >= 0; i--) {
    const item = sortedByLast[i];
    const ts = getWatchTime(item);
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const monthYear = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        if (!timeline[monthYear]) {
          timeline[monthYear] = [];
        }
        timeline[monthYear].push(item);
      }
    }
  }

  // Recently watched
  const recentlyWatched = sortedByLast.slice().reverse().slice(0, 10);

  // Average IMDb rating
  const avgImdbRating = ratedItemsCount > 0
    ? (ratedItemsSum / ratedItemsCount).toFixed(1)
    : "0.0";

  // Heatmap: Month of year vs Day of month (12 x 31) only for current year
  const heatmap: { month: number; day: number; count: number }[] = [];
  Object.entries(heatmapGrid).forEach(([key, count]) => {
    const [month, day] = key.split("-").map(Number);
    heatmap.push({ month, day, count });
  });

  // Top decades
  const topDecades = Object.entries(decadeCounts)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.count - a.count);

  // Sorting helper
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
  const getWatchTime = (e: PlaybackEvent) => {
    if (e.lastWatched) return normalizeTimestamp(e.lastWatched);
    return normalizeTimestamp(e.finished_at || e.started_at);
  };

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
