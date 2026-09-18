import { describe, it } from "vitest";
import { groupEventsIntoTimeline } from "./stats";
import { PlaybackEvent } from "../types";

function generateMockEvents(count: number): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  const baseTs = 1700000000000; // ~ Nov 2023
  for (let i = 0; i < count; i++) {
    // Random timestamps spanning ~3 years
    const randomOffset = Math.floor(Math.random() * 3 * 365 * 24 * 60 * 60 * 1000);
    const ts = baseTs + randomOffset;
    events.push({
      imdb_id: `tt${1000000 + i}`,
      title: `Movie ${i}`,
      type: i % 3 === 0 ? "series" : "movie",
      started_at: new Date(ts).toISOString(),
      finished_at: new Date(ts + 7200000).toISOString(),
      lastWatched: ts + 7200000,
      watch_count: (i % 5) + 1,
      progress: 100,
    } as unknown as PlaybackEvent);
  }
  return events;
}

describe("groupEventsIntoTimeline Performance Benchmark", () => {
  it("benchmark groupEventsIntoTimeline with 1,000, 5,000, and 10,000 items", () => {
    const sizes = [1000, 5000, 10000];

    for (const size of sizes) {
      const events = generateMockEvents(size);

      // Warm up
      groupEventsIntoTimeline(events.slice(0, 100));

      const iterations = 20;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        groupEventsIntoTimeline(events);
      }
      const totalMs = performance.now() - start;
      const avgMs = totalMs / iterations;

      console.log(`[BENCHMARK] Size: ${size} items | Avg Time per call: ${avgMs.toFixed(3)}ms (Total ${iterations} calls: ${totalMs.toFixed(2)}ms)`);
    }
  });
});
