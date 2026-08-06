import { PlaybackEvent } from "../types";
import { formatBuenosAiresDate } from "./date";

/**
 * Converts playback events to a CSV string.
 */
export function convertToCSV(events: PlaybackEvent[]): string {
  const headers = [
    "IMDb ID",
    "Title",
    "Type",
    "Season",
    "Episode",
    "Episode Title",
    "Started At",
    "Finished At",
    "Progress %",
    "Watch Count",
    "Duration (ms)",
    "Time Watched (ms)",
    "Genres",
    "Year",
    "Directors"
  ];

  const escapeCSV = (val: any) => {
    if (val === undefined || val === null) return "";
    let str = String(val);
    if (str.includes(",") || str.includes("\"") || str.includes("\n") || str.includes("\r")) {
      str = "\"" + str.replace(/"/g, "\"\"") + "\"";
    }
    return str;
  };

  const rows = events.map(event => [
    escapeCSV(event.imdb_id),
    escapeCSV(event.title),
    escapeCSV(event.type),
    escapeCSV(event.season ?? ""),
    escapeCSV(event.episode ?? ""),
    escapeCSV(event.episode_title ?? ""),
    escapeCSV(formatBuenosAiresDate(event.started_at)),
    escapeCSV(formatBuenosAiresDate(event.finished_at)),
    escapeCSV(event.progress),
    escapeCSV(event.watch_count),
    escapeCSV(event.duration),
    escapeCSV(event.time_watched),
    escapeCSV(event.genres?.join("; ") ?? ""),
    escapeCSV(event.year ?? ""),
    escapeCSV(event.directors?.join("; ") ?? "")
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

/**
 * Converts playback events to JSON string.
 */
export function convertToJSON(events: PlaybackEvent[]): string {
  return JSON.stringify(events, null, 2);
}
