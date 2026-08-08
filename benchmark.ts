import { computeAnalytics } from './src/analytics/stats';
import { PlaybackEvent } from './src/types';

const generateMockData = (count: number): PlaybackEvent[] => {
  const library: PlaybackEvent[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    library.push({
      _id: `id_${i}`,
      type: i % 3 === 0 ? 'series' : 'movie',
      title: `Title ${i % 100}`,
      releaseYear: (1950 + (i % 70)).toString(),
      watch_count: 1,
      time_watched: 120,
      started_at: new Date(now - (i * 1000000)).toISOString(),
      lastWatched: new Date(now - (i * 1000000)).toISOString(),
      genres: ['Action', 'Comedy'],
      directors: ['Director A'],
      imdbRating: (5 + (i % 5)).toString(),
      poster: '',
      background: '',
      url: '',
      firstWatched: '',
    });
  }
  return library;
};

const library = generateMockData(100000);

const start = performance.now();
for(let i=0; i<10; i++) {
  computeAnalytics(library);
}
const end = performance.now();

console.log(`Time taken: ${(end - start) / 10} ms`);
