import { PlaybackEvent, WatchStats } from "../types";

export interface AnalyticsSummary extends WatchStats {
  topGenres: { name: string; count: number }[];
  topDirectors: { name: string; count: number }[];
  topYears: { name: string; count: number }[];
  mostWatched: { title: string; count: number; type: string }[];
  activityByMonth: { month: string; count: number }[]; // "YYYY-MM"
  activityByYear: { year: string; count: number }[]; // "YYYY"
  heatmap: { day: number; hour: number; count: number }[]; // 7x24 grid
}

export function computeAnalytics(events: PlaybackEvent[]): AnalyticsSummary {
  const stats: WatchStats = {
    totalMovies: 0,
    totalSeries: 0,
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
  const monthlyActivity: Record<string, number> = {};
  const yearlyActivity: Record<string, number> = {};

  // Initialize heatmap structure (7 days, 24 hours)
  const heatmapGrid: Record<string, number> = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmapGrid[`${d}-${h}`] = 0;
    }
  }

  if (events.length === 0) {
    return {
      ...stats,
      topGenres: [],
      topDirectors: [],
      topYears: [],
      mostWatched: [],
      activityByMonth: [],
      activityByYear: [],
      heatmap: Object.entries(heatmapGrid).map(([key, count]) => {
        const [day, hour] = key.split("-").map(Number);
        return { day, hour, count };
      })
    };
  }

  // Sort events by started_at ascending to identify first recorded easily
  const chronEvents = [...events].sort((a, b) =>
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  stats.firstRecorded = chronEvents[0] || null;
  stats.lastWatched = chronEvents[chronEvents.length - 1] || null;

  const movieIdsSeen = new Set<string>();
  const seriesIdsSeen = new Set<string>();

  for (const event of events) {
    // Media counts
    if (event.type === "movie") {
      movieIdsSeen.add(event.imdb_id);
    } else if (event.type === "series") {
      seriesIdsSeen.add(event.parent_id || event.imdb_id.split(":")[0]);
    }

    // Cumulative watches
    stats.totalWatchCount += (event.watch_count || 1);
    stats.estimatedWatchTime += event.time_watched || 0;

    // Genres
    if (event.genres) {
      for (const g of event.genres) {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }

    // Directors
    if (event.directors) {
      for (const d of event.directors) {
        directorCounts[d] = (directorCounts[d] || 0) + 1;
      }
    }

    // Release Year
    if (event.year) {
      yearCounts[event.year] = (yearCounts[event.year] || 0) + 1;
    }

    // Most Watched Titles
    const titleKey = event.title;
    if (!titleCounts[titleKey]) {
      titleCounts[titleKey] = { count: 0, type: event.type };
    }
    titleCounts[titleKey].count += (event.watch_count || 1);

    // Timestamps activity
    const startDate = new Date(event.started_at);
    if (!isNaN(startDate.getTime())) {
      // Heatmap (day: 0-6, hour: 0-23 in local/provided time)
      // Since date formatting timezone is America/Argentina/Buenos_Aires, we should idealize the date in that TZ
      // Or just standard local hours as helper
      const day = startDate.getDay();
      const hour = startDate.getHours();
      heatmapGrid[`${day}-${hour}`] = (heatmapGrid[`${day}-${hour}`] || 0) + 1;

      // Monthly activity "YYYY-MM"
      const yyyy = startDate.getFullYear();
      const mm = String(startDate.getMonth() + 1).padStart(2, "0");
      const monthKey = `${yyyy}-${mm}`;
      monthlyActivity[monthKey] = (monthlyActivity[monthKey] || 0) + 1;

      // Yearly activity "YYYY"
      const yearKey = String(yyyy);
      yearlyActivity[yearKey] = (yearlyActivity[yearKey] || 0) + 1;
    }
  }

  stats.totalMovies = movieIdsSeen.size;
  stats.totalSeries = seriesIdsSeen.size;

  // Sorting and formatting helper
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

  const activityByMonthList = Object.entries(monthlyActivity)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const activityByYearList = Object.entries(yearlyActivity)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const heatmapList = Object.entries(heatmapGrid).map(([key, count]) => {
    const [day, hour] = key.split("-").map(Number);
    return { day, hour, count };
  });

  return {
    ...stats,
    topGenres: topGenresList,
    topDirectors: topDirectorsList,
    topYears: topYearsList,
    mostWatched: mostWatchedList,
    activityByMonth: activityByMonthList,
    activityByYear: activityByYearList,
    heatmap: heatmapList
  };
}

export function groupEventsIntoTimeline(events: PlaybackEvent[]) {
  // Sort descending by start date
  const sorted = [...events].sort((a, b) =>
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );

  const timeline: Record<string, Record<string, PlaybackEvent[]>> = {};

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  for (const event of sorted) {
    const d = new Date(event.started_at);
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
