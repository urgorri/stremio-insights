import { PlaybackEvent, WatchStats } from "../types";
import { normalizeTimestamp } from "../utils/date";

export interface AnalyticsSummary extends WatchStats {
  mostWatchedYear: number;
  timeline: Record<string, PlaybackEvent[]>;
  recentlyWatched: PlaybackEvent[];
  avgImdbRating: string;
  moviesPerMonth: Record<string, number>;
  heatmap: { day: number; hour: number; count: number }[];
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

  // Resolve watch timestamp helper, preferring lastWatched, falling back to finished_at or started_at
  const getWatchTime = (e: PlaybackEvent) => {
    if (e.lastWatched) return normalizeTimestamp(e.lastWatched);
    return normalizeTimestamp(e.finished_at || e.started_at);
  };

  const getFirstWatchTime = (e: PlaybackEvent) => {
    if (e.firstWatched) return normalizeTimestamp(e.firstWatched);
    return normalizeTimestamp(e.started_at);
  };

  // Sort by first watch time to find firstRecorded
  const sortedByFirst = library
    .slice()
    .sort((a, b) => getFirstWatchTime(a) - getFirstWatchTime(b));
  stats.firstRecorded = sortedByFirst[0] || null;

  // Sort by watch time to find lastWatched
  const sortedByLast = library
    .slice()
    .sort((a, b) => getWatchTime(a) - getWatchTime(b));
  stats.lastWatched = sortedByLast[sortedByLast.length - 1] || null;

  // Most watched year
  const libraryYearCounts: Record<number, number> = {};

  library.forEach(item => {
    stats.totalWatchCount += (item.watch_count || 1);
    stats.estimatedWatchTime += (item.time_watched || 0);

    if (item.year) {
      const yr = Number(item.year);
      if (!isNaN(yr)) {
        libraryYearCounts[yr] = (libraryYearCounts[yr] || 0) + 1;
        yearCounts[yr] = (yearCounts[yr] || 0) + 1;
      }
    }

    if (item.genres) {
      item.genres.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }

    if (item.directors) {
      item.directors.forEach(d => {
        directorCounts[d] = (directorCounts[d] || 0) + 1;
      });
    }

    const titleKey = item.title;
    if (!titleCounts[titleKey]) {
      titleCounts[titleKey] = { count: 0, type: item.type };
    }
    titleCounts[titleKey].count += (item.watch_count || 1);
  });

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
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  library
    .slice()
    .sort((a, b) => getWatchTime(b) - getWatchTime(a))
    .forEach(item => {
      const ts = getWatchTime(item);
      if (ts) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          const monthYear = `${months[d.getMonth()]} ${d.getFullYear()}`;
          if (!timeline[monthYear]) {
            timeline[monthYear] = [];
          }
          timeline[monthYear].push(item);
        }
      }
    });

  // Recently watched
  const recentlyWatched = sortedByLast.slice().reverse().slice(0, 10);

  // Average IMDb rating
  const ratedItems = library.filter(item => item.imdbRating && !isNaN(parseFloat(item.imdbRating)));
  const avgImdbRating = ratedItems.length > 0
    ? (ratedItems.reduce((sum, item) => sum + parseFloat(item.imdbRating!), 0) / ratedItems.length).toFixed(1)
    : "0.0";

  // Movies watched per month
  const moviesPerMonth: Record<string, number> = {};
  movies.forEach(item => {
    const ts = getWatchTime(item);
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        moviesPerMonth[key] = (moviesPerMonth[key] || 0) + 1;
      }
    }
  });

  // Heatmap: Day vs Hour (7 x 24)
  const heatmap: { day: number; hour: number; count: number }[] = [];
  const heatmapGrid: Record<string, number> = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmapGrid[`${d}-${h}`] = 0;
    }
  }
  library.forEach(item => {
    const ts = getWatchTime(item);
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const day = d.getDay();
        const hour = d.getHours();
        heatmapGrid[`${day}-${hour}`] = (heatmapGrid[`${day}-${hour}`] || 0) + 1;
      }
    }
  });
  Object.entries(heatmapGrid).forEach(([key, count]) => {
    const [day, hour] = key.split("-").map(Number);
    heatmap.push({ day, hour, count });
  });

  // Top decades
  const decadeCounts: Record<string, number> = {};
  library.forEach(item => {
    if (item.year) {
      const yr = Number(item.year);
      if (!isNaN(yr)) {
        const decade = `${Math.floor(yr / 10) * 10}s`;
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
      }
    }
  });
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

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  for (const event of sorted) {
    const ts = getWatchTime(event);
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;

    const year = String(d.getFullYear());
    const month = months[d.getMonth()];

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
