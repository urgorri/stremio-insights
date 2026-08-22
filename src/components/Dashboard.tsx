import React, { useEffect, useState, useMemo } from "react";
import { useInsightsStore } from "../hooks/useInsightsStore";
import { formatBuenosAiresDate, formatBuenosAiresDateOnly, normalizeReleaseYear } from "../utils/date";
import { groupEventsIntoTimeline } from "../analytics/stats";
import { HEATMAP_MONTHS_COUNT, HEATMAP_DAYS_COUNT } from "../utils/constants";
import {
  Tv,
  Film,
  Clock,
  Flame,
  Calendar,
  Tag,
  User,
  Download,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Filter,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const {
    stats,
    searchQuery,
    filters,
    syncLoading,
    syncError,
    fetchData,
    performSync,
    clearHistory,
    setSearchQuery,
    setFilters,
    getFilteredEvents
  } = useInsightsStore();

  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "analytics" | "settings">("overview");
  const [isStremioTabActive, setIsStremioTabActive] = useState<boolean | null>(null);

  const isPopup = typeof window !== "undefined" && window.location.protocol === "chrome-extension:";

  useEffect(() => {
    fetchData();

    // Auto-sync if running inside extension popup when a Stremio tab is open and active
    if (isPopup) {
      console.log("[SYNC]\nPopup opened");
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ url: "https://web.stremio.com/*" }, (tabs) => {
          if (tabs && tabs.length > 0) {
            setIsStremioTabActive(true);

            // Only auto-sync on load if there is an active (focused) Stremio tab
            const hasActiveTab = tabs.some(tab => tab.active);
            if (hasActiveTab) {
              console.log("[SYNC]\nActive Stremio tab is open. Starting on-demand sync...");
              if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(["stremio_auth_key"], async (res) => {
                  const key = res.stremio_auth_key || "";
                  try {
                    await performSync(key);
                  } catch (err: any) {
                    console.warn("[SYNC] Auto sync on popup load skipped or deferred:", err.message || err);
                  }
                });
              } else {
                performSync("").catch((err: any) => {
                  console.warn("[SYNC] Auto sync on popup load skipped or deferred:", err.message || err);
                });
              }
            } else {
              console.log("[SYNC]\nStremio tab is in the background. Skipping auto-sync on load to prevent communication failures.");
            }
          } else {
            console.log("[SYNC]\nNo active Stremio tab found.");
            setIsStremioTabActive(false);
          }
        });
      }
    }

    // Listen for real-time synchronization updates
    const handleMessage = (msg: any) => {
      if (msg && msg.type === "DATA_SYNCHRONIZED") {
        console.log("[Stremio Insights Popup] Received DATA_SYNCHRONIZED. Refreshing statistics...");
        fetchData();
      }
    };
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }
    return () => {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    };
  }, [fetchData]);

  const handleExport = async (format: "csv" | "json") => {
    chrome.runtime.sendMessage(
      { type: "EXPORT_DATA", payload: { format } },
      (response) => {
        if (response && response.success && response.data) {
          const blob = new Blob([response.data], {
            type: format === "csv" ? "text/csv" : "application/json"
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `stremio_insights_history_${new Date().toISOString().split("T")[0]}.${format}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    );
  };

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear all recorded watch history? This cannot be undone.")) {
      await clearHistory();
    }
  };

  const filteredEvents = getFilteredEvents();
  const timeline = groupEventsIntoTimeline(filteredEvents);

  // Pre-compute heatmap map for O(1) lookups
  const heatmapMap = useMemo(() => {
    const map = new Map();
    if (stats?.heatmap) {
      for (const item of stats.heatmap) {
        map.set(`${item.month}-${item.day}`, item);
      }
    }
    return map;
  }, [stats?.heatmap]);

  // Helper to format watch time from ms to human-readable
  const formatWatchTime = (ms: number) => {
    const totalMins = Math.floor(ms / (1000 * 60));
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  // Generate lists of unique genres and years for dropdown selection
  const uniqueGenres = Array.from(
    new Set(
      filteredEvents
        .flatMap((e) => e.genres || [])
        .filter(Boolean)
    )
  ).sort();

  const uniqueYears = Array.from(
    new Set(
      filteredEvents
        .map((e) => normalizeReleaseYear(e.releaseYear || e.year))
    )
  ).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return b.localeCompare(a);
  });

  if (isPopup && isStremioTabActive === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0d0e15] text-white p-6 text-center space-y-4" style={{ width: "380px", height: "550px" }}>
        <AlertCircle className="w-12 h-12 text-purple-500 animate-pulse" />
        <h2 className="text-base font-bold text-gray-200">Stremio is not active</h2>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          Open Stremio Continue Watching to synchronize.
        </p>
        <button
          onClick={() => {
            if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: "https://web.stremio.com/#/continuewatching" });
            } else {
              window.open("https://web.stremio.com/#/continuewatching", "_blank");
            }
          }}
          className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded font-bold text-xs flex items-center gap-1.5 transition-all shadow-md hover:shadow-purple-500/20"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Stremio
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-[#0d0e15] text-white font-sans overflow-hidden">
      {syncLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-semibold text-purple-300">Synchronizing...</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#12131c]">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-purple-500 animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Stremio Insights
          </h1>
        </div>
        {(isStremioTabActive || !isPopup) && (
          <button
            onClick={async () => {
              if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(["stremio_auth_key"], async (res) => {
                  const key = res.stremio_auth_key || "";
                  try {
                    await performSync(key);
                  } catch (err) {
                    console.error("[SYNC] Manual sync failed:", err);
                  }
                });
              } else {
                try {
                  await performSync("");
                } catch (err) {
                  console.error("[SYNC] Manual sync failed:", err);
                }
              }
            }}
            disabled={syncLoading}
            className="p-1.5 hover:bg-gray-800/60 rounded text-gray-400 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center"
            title="Synchronize now"
          >
            <RefreshCw className={`w-4 h-4 ${syncLoading ? "animate-spin text-purple-400" : ""}`} />
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-800 bg-[#12131c] text-xs">
        {(["overview", "timeline", "analytics", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-center font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? "border-purple-500 text-purple-400 bg-purple-500/5"
                : "border-transparent text-gray-400 hover:text-white hover:bg-gray-800/30"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Summary Statistics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#151622] p-3 rounded-lg border border-gray-800/80 flex flex-col justify-between">
                <div className="flex justify-between items-start text-gray-400">
                  <span className="text-xs font-semibold">Movies</span>
                  <Film className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold mt-2">{stats?.totalMovies || 0}</div>
              </div>

              <div className="bg-[#151622] p-3 rounded-lg border border-gray-800/80 flex flex-col justify-between">
                <div className="flex justify-between items-start text-gray-400">
                  <span className="text-xs font-semibold">Series</span>
                  <Tv className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold mt-2">{stats?.totalSeries || 0}</div>
              </div>

              <div className="bg-[#151622] p-3 rounded-lg border border-gray-800/80 flex flex-col justify-between">
                <div className="flex justify-between items-start text-gray-400">
                  <span className="text-xs font-semibold">Watch Count</span>
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-2xl font-bold mt-2">{stats?.totalWatchCount || 0}</div>
              </div>

              <div className="bg-[#151622] p-3 rounded-lg border border-gray-800/80 flex flex-col justify-between">
                <div className="flex justify-between items-start text-gray-400">
                  <span className="text-xs font-semibold">Watch Time</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-lg font-bold mt-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatWatchTime(stats?.estimatedWatchTime || 0)}
                </div>
              </div>
            </div>

            {/* Favorite preferences */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs">
              <h3 className="font-bold text-gray-300 border-b border-gray-800 pb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-400" /> Top Genres & Favorites
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Favorite Genres:</span>
                  <span className="font-semibold text-purple-300">
                    {stats?.favoriteGenres?.join(", ") || "None recorded"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Favorite Years:</span>
                  <span className="font-semibold text-purple-300">
                    {stats?.favoriteYears?.join(", ") || "None recorded"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Favorite Directors:</span>
                  <span className="font-semibold text-purple-300">
                    {stats?.favoriteDirectors?.map(d => {
                      const parts = d.trim().split(/\s+/);
                      return parts[parts.length - 1];
                    }).join(", ") || "None recorded"}
                  </span>
                </div>
              </div>
            </div>

            {/* First and Last items */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs">
              <h3 className="font-bold text-gray-300 border-b border-gray-800 pb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" /> Milestones
              </h3>
              <div className="space-y-3.5">
                <div>
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold">Last Watched</div>
                  <div className="font-bold text-gray-200 mt-0.5">
                    {stats?.lastWatched?.title || "No history logged"}
                  </div>
                  {stats?.lastWatched && (
                    <div className="text-[10px] text-purple-400 mt-0.5">
                      {formatBuenosAiresDate(stats.lastWatched.started_at)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold">First Recorded</div>
                  <div className="font-bold text-gray-200 mt-0.5">
                    {stats?.firstRecorded?.title || "No history logged"}
                  </div>
                  {stats?.firstRecorded && (
                    <div className="text-[10px] text-purple-400 mt-0.5">
                      {formatBuenosAiresDate(stats.firstRecorded.started_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-4">
            {/* Search and Filters panel */}
            <div className="bg-[#151622] p-3 rounded-lg border border-gray-800/80 space-y-3 text-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search title, IMDb ID, genre, year..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-gray-800 rounded py-2 pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ type: e.target.value as any })}
                    className="w-full bg-black/40 border border-gray-800 rounded py-1.5 px-2 text-[11px] focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All</option>
                    <option value="movie">Movies</option>
                    <option value="series">Series</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Genre</label>
                  <select
                    value={filters.genre}
                    onChange={(e) => setFilters({ genre: e.target.value })}
                    className="w-full bg-black/40 border border-gray-800 rounded py-1.5 px-2 text-[11px] focus:outline-none focus:border-purple-500"
                  >
                    <option value="">All</option>
                    {uniqueGenres.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Year</label>
                  <select
                    value={filters.year}
                    onChange={(e) => setFilters({ year: e.target.value })}
                    className="w-full bg-black/40 border border-gray-800 rounded py-1.5 px-2 text-[11px] focus:outline-none focus:border-purple-500"
                  >
                    <option value="">All</option>
                    {uniqueYears.map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Timeline Tree rendering */}
            <div className="space-y-4">
              {Object.keys(timeline).length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No playback sessions found matching criteria.
                </div>
              ) : (
                Object.entries(timeline)
                  .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
                  .map(([year, monthsObj]) => {
                    const months = [
                      "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"
                    ];
                    const sortedMonths = Object.entries(monthsObj).sort(
                      ([monthA], [monthB]) => months.indexOf(monthB) - months.indexOf(monthA)
                    );
                    return (
                      <div key={year} className="space-y-2">
                        <h2 className="text-sm font-black text-purple-400 border-b border-purple-500/20 pb-0.5 tracking-wider">
                          {year}
                        </h2>
                        <div className="space-y-3">
                          {sortedMonths.map(([month, events]) => (
                            <div key={month} className="space-y-1.5">
                              <h3 className="text-xs font-bold text-blue-400/90 tracking-wide uppercase">
                                {month}
                              </h3>
                              <div className="pl-2 border-l border-gray-800 space-y-2">
                            {events.map((event, index) => {
                              const watchTs = event.lastWatched || event.firstWatched || event.finished_at || event.started_at;
                              const formattedWatchDate = watchTs ? formatBuenosAiresDateOnly(watchTs) : "Unknown";
                              const dispYear = normalizeReleaseYear(event.releaseYear || event.year);

                              const id = event.imdbId || event.imdb_id;
                              const cleanId = event.type === "series" ? (event.parent_id || id?.split(":")[0]) : id;
                              const stremioUrl = `https://web.stremio.com/#/detail/${encodeURIComponent(event.type || "")}/${encodeURIComponent(cleanId || "")}`;

                              return (
                                <a
                                  key={index}
                                  href={stremioUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-[#12131c]/50 hover:bg-[#151622] p-2.5 rounded border border-gray-800/40 hover:border-purple-500/20 transition-all flex items-center gap-3 cursor-pointer block"
                                >
                                  {/* Poster */}
                                  <div className="w-10 h-14 bg-gray-800 rounded overflow-hidden shrink-0 flex items-center justify-center border border-gray-700/30">
                                    {event.poster ? (
                                      <img src={event.poster} alt={event.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <Film className="w-5 h-5 text-gray-600" />
                                    )}
                                  </div>

                                  {/* Info */}
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {event.type === "movie" ? (
                                        <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                      ) : (
                                        <Tv className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      )}
                                      <span className="font-bold text-xs text-gray-200 truncate">
                                        {event.title} {dispYear && dispYear !== "Unknown" ? `(${dispYear})` : ""}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 pl-5">
                                      Last watched: <span className="font-semibold text-purple-400">{formattedWatchDate}</span>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="text-[10px] font-bold text-purple-400">
                                      {event.progress}%
                                    </div>
                                    <div className="text-[9px] text-gray-500">
                                      Count: {event.watch_count || 1}
                                    </div>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-4">
            {/* Top Genres bar chart simulation */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs">
              <h3 className="font-bold text-gray-300 flex items-center gap-1.5">
                Top Genres
              </h3>
              <div className="space-y-2">
                {stats?.topGenres?.slice(0, 5).map((genre) => {
                  const maxCount = stats.topGenres[0]?.count || 1;
                  const percentage = Math.round((genre.count / maxCount) * 100);
                  return (
                    <div key={genre.name} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-300 font-medium">{genre.name}</span>
                        <span className="text-purple-400 font-bold">{genre.count} watches</span>
                      </div>
                      <div className="w-full bg-black/50 h-2 rounded overflow-hidden border border-gray-800">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                }) || <div className="text-gray-500 py-2">No genre statistics available.</div>}
              </div>
            </div>

            {/* Top Directors as a gorgeous bar chart */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs">
              <h3 className="font-bold text-gray-300 flex items-center gap-1.5">
                Top Directors (Movies per Director)
              </h3>
              <div className="space-y-2">
                {stats?.topDirectors?.slice(0, 5).map((dir, index) => {
                  const maxCount = stats.topDirectors[0]?.count || 1;
                  const percentage = Math.round((dir.count / maxCount) * 100);
                  return (
                    <div key={dir.name} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-300 font-medium">
                          {index + 1}. {dir.name}
                        </span>
                        <span className="text-purple-400 font-bold">
                          {dir.count} {dir.count === 1 ? "movie" : "movies"}
                        </span>
                      </div>
                      <div className="w-full bg-black/50 h-2 rounded overflow-hidden border border-gray-800">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                }) || <div className="text-gray-500 py-2">No director statistics available.</div>}
              </div>
            </div>

            {/* Top Years panel */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs">
              <h3 className="font-bold text-gray-300">Top Release Years</h3>
              <div className="space-y-1.5 mt-2">
                {stats?.topYears?.slice(0, 5).map((y, index) => (
                  <div key={y.name} className="flex justify-between text-[11px] text-gray-300 py-1 border-b border-gray-800/40 last:border-0">
                    <span>{index + 1}. {y.name}</span>
                    <span className="font-bold text-blue-400">{y.count} titles</span>
                  </div>
                )) || <div className="text-gray-500">None</div>}
              </div>
            </div>

            {/* Most Watched Titles list */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs">
              <h3 className="font-bold text-gray-300">Most Watched</h3>
              <div className="space-y-2">
                {stats?.mostWatched?.slice(0, 5).map((mw, index) => (
                  <div key={index} className="flex items-center justify-between py-1.5 border-b border-gray-800/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] bg-purple-500/10 text-purple-400 font-bold px-1.5 py-0.5 rounded shrink-0">
                        #{index + 1}
                      </span>
                      <span className="text-[11px] text-gray-200 font-medium truncate">{mw.title}</span>
                    </div>
                    <span className="text-[11px] font-bold text-purple-400 shrink-0">{mw.count} watch events</span>
                  </div>
                )) || <div className="text-gray-500">No events logged yet.</div>}
              </div>
            </div>

            {/* Watch Heatmap Grid */}
            <div id="watch-heatmap-card" className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs overflow-x-auto">
              <h3 className="font-bold text-gray-300 flex items-center gap-1">
                Watch Heatmap <span className="text-[9px] text-gray-500 font-normal ml-1">({new Date().getFullYear()} - Months vs Days of Month)</span>
              </h3>
              <div className="flex flex-col gap-0.5 min-w-[280px]">
                {/* Months Header (Horizontal) */}
                <div className="flex gap-0.5 mb-1 text-[8px] text-gray-500 font-bold">
                  {/* Invisible spacer matching the day label width */}
                  <span className="w-5 shrink-0" />
                  {Array.from({ length: HEATMAP_MONTHS_COUNT }).map((_, m) => {
                    const monthLabel = String(m + 1).padStart(2, "0");
                    return (
                      <span key={m} className="w-5 text-center shrink-0">{monthLabel}</span>
                    );
                  })}
                </div>

                {/* 31 Days Rows (Vertical) */}
                {Array.from({ length: HEATMAP_DAYS_COUNT }).map((_, d) => {
                  const dayNum = d + 1;
                  const dayLabel = String(dayNum).padStart(2, "0");
                  return (
                    <div key={d} className="flex gap-0.5 items-center">
                      {/* Day Row Label */}
                      <span className="w-5 text-[8px] text-gray-400 font-bold shrink-0 text-right pr-1">{dayLabel}</span>

                      {/* 12 Months Columns */}
                      {Array.from({ length: HEATMAP_MONTHS_COUNT }).map((_, m) => {
                        const monthNum = m + 1;

                        // Check if this date is valid in the current year
                        const currentYear = new Date().getFullYear();
                        const checkDate = new Date(currentYear, monthNum - 1, dayNum);
                        const isValid =
                          checkDate.getFullYear() === currentYear &&
                          checkDate.getMonth() === monthNum - 1 &&
                          checkDate.getDate() === dayNum;

                        if (!isValid) {
                          return (
                            <div
                              key={m}
                              className="w-5 h-5 shrink-0 bg-transparent"
                            />
                          );
                        }

                        const cell = heatmapMap.get(`${monthNum}-${dayNum}`);
                        const count = cell?.count || 0;

                        // Select color depth based on watch frequency
                        let bgClass = "bg-gray-800/20";
                        if (count > 0 && count < 3) bgClass = "bg-purple-900/40 border border-purple-800/20";
                        else if (count >= 3 && count < 6) bgClass = "bg-purple-700/60";
                        else if (count >= 6 && count < 10) bgClass = "bg-purple-500/80";
                        else if (count >= 10) bgClass = "bg-purple-400 shadow-[0_0_4px_#a855f7]";

                        // Tooltip info
                        const monthsNames = [
                          "January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"
                        ];

                        return (
                          <div
                            key={m}
                            title={`${monthsNames[m]} ${dayLabel}: ${count} watch events`}
                            className={`w-5 h-5 rounded-sm transition-colors cursor-help flex items-center justify-center shrink-0 ${bgClass}`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4 text-xs">
            {/* Local persistence & exports */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3">
              <h3 className="font-bold text-gray-300 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-blue-400" /> Export / Management
              </h3>
              <p className="text-[11px] text-gray-400">
                Backup or analyze your fully captured chronological watch history.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => handleExport("csv")}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded py-2 font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-700/50"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
                <button
                  onClick={() => handleExport("json")}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded py-2 font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-700/50"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
              </div>

              <div className="border-t border-gray-800/60 pt-3 mt-3">
                <button
                  onClick={handleClear}
                  className="w-full bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-900/30 rounded py-2 font-bold flex items-center justify-center gap-1.5 transition-all text-[11px]"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Local History
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
