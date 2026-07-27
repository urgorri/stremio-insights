export type ContentType = "movie" | "series";

export interface PlaybackEvent {
  id?: number; // Auto-increment database id
  imdb_id: string; // Movie ID (e.g. tt123) or Episode ID (e.g. tt123:1:1)
  parent_id?: string; // Series ID for episodes (e.g. tt123)
  title: string;
  type: ContentType;
  season?: number;
  episode?: number;
  episode_title?: string;
  started_at: string; // ISO String (America/Argentina/Buenos_Aires timezone handled at presentation)
  finished_at: string; // ISO String
  progress: number; // 0-100
  watch_count: number;
  duration: number; // in milliseconds
  time_watched: number; // in milliseconds
  genres?: string[];
  year?: number;
  directors?: string[];
}

export interface WatchStats {
  totalMovies: number;
  totalSeries: number;
  totalWatchCount: number;
  estimatedWatchTime: number; // in ms
  favoriteGenres: string[];
  favoriteYears: number[];
  favoriteDirectors: string[];
  lastWatched: PlaybackEvent | null;
  firstRecorded: PlaybackEvent | null;
}

export interface StremioProfile {
  auth?: {
    key: string;
    user?: {
      id: string;
      email: string;
    };
  };
}

export interface StremioLibraryItem {
  _id: string;
  name: string;
  type: ContentType;
  poster?: string;
  state?: {
    lastWatched?: string;
    timesWatched?: number;
    timeWatched?: number;
    duration?: number;
    video_id?: string;
    watched?: string;
  };
}
