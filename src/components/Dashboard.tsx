import React, { useEffect, useState } from "react";
import { useInsightsStore } from "../hooks/useInsightsStore";
import { formatBuenosAiresDate } from "../utils/date";
import { groupEventsIntoTimeline } from "../analytics/stats";
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
  AlertCircle
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

  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "analytics" | "sync">("overview");
  const [authKey, setAuthKey] = useState("");
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // Pre-fill authKey if available in chrome storage
    chrome.storage.local.get(["stremio_auth_key"], (res) => {
      if (res.stremio_auth_key) {
        setAuthKey(res.stremio_auth_key);
      }
    });
  }, [fetchData]);

  const handleSync = async () => {
    if (!authKey.trim()) return;
    try {
      setSyncSuccessMsg(null);
      const imported = await performSync(authKey);
      setSyncSuccessMsg(`Successfully imported ${imported} historical watch sessions!`);
    } catch (e: any) {
      console.error(e);
    }
  };

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
      getFilteredEvents()
        .flatMap((e) => e.genres || [])
        .filter(Boolean)
    )
  ).sort();

  const uniqueYears = Array.from(
    new Set(
      getFilteredEvents()
        .map((e) => e.year)
        .filter(Boolean)
    )
  ).sort((a, b) => b! - a!);

  return (
    <div className="flex flex-col h-full bg-[#0d0e15] text-white font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#12131c]">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-purple-500 animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Stremio Insights
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchData()}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-800 bg-[#12131c] text-xs">
        {(["overview", "timeline", "analytics", "sync"] as const).map((tab) => (
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
                    {stats?.favoriteDirectors?.join(", ") || "None recorded"}
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
                Object.entries(timeline).map(([year, monthsObj]) => (
                  <div key={year} className="space-y-2">
                    <h2 className="text-sm font-black text-purple-400 border-b border-purple-500/20 pb-0.5 tracking-wider">
                      {year}
                    </h2>
                    <div className="pl-2 space-y-3">
                      {Object.entries(monthsObj).map(([month, events]) => (
                        <div key={month} className="space-y-1.5">
                          <h3 className="text-xs font-bold text-blue-400/90 tracking-wide uppercase">
                            {month}
                          </h3>
                          <div className="pl-2 border-l border-gray-800 space-y-2">
                            {events.map((event, index) => (
                              <div
                                key={index}
                                className="bg-[#12131c]/50 hover:bg-[#151622] p-2.5 rounded border border-gray-800/40 hover:border-purple-500/20 transition-all flex justify-between items-start gap-2"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {event.type === "movie" ? (
                                      <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    ) : (
                                      <Tv className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                    )}
                                    <span className="font-bold text-xs text-gray-200 truncate">
                                      {event.title}
                                    </span>
                                  </div>
                                  {event.type === "series" && (
                                    <div className="text-[10px] text-gray-400 font-medium pl-5">
                                      S{event.season} E{event.episode} {event.episode_title}
                                    </div>
                                  )}
                                  <div className="text-[9px] text-gray-500 pl-5">
                                    Watched: {formatBuenosAiresDate(event.started_at)}
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
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
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

            {/* Top Directors and Top Years panels side by side */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#151622] p-3 rounded-lg border border-gray-800/80 space-y-2">
                <h4 className="font-bold text-gray-300">Top Directors</h4>
                <div className="space-y-1.5 mt-2">
                  {stats?.topDirectors?.slice(0, 3).map((dir) => (
                    <div key={dir.name} className="flex justify-between text-[11px] text-gray-300">
                      <span className="truncate max-w-[100px]">{dir.name}</span>
                      <span className="font-bold text-purple-400 shrink-0">{dir.count}</span>
                    </div>
                  )) || <div className="text-gray-500">None</div>}
                </div>
              </div>

              <div className="bg-[#151622] p-3 rounded-lg border border-gray-800/80 space-y-2">
                <h4 className="font-bold text-gray-300">Top Release Years</h4>
                <div className="space-y-1.5 mt-2">
                  {stats?.topYears?.slice(0, 3).map((y) => (
                    <div key={y.name} className="flex justify-between text-[11px] text-gray-300">
                      <span>{y.name}</span>
                      <span className="font-bold text-blue-400">{y.count}</span>
                    </div>
                  )) || <div className="text-gray-500">None</div>}
                </div>
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
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3 text-xs overflow-x-auto">
              <h3 className="font-bold text-gray-300 flex items-center gap-1">
                Watch Heatmap <span className="text-[9px] text-gray-500 font-normal ml-1">(Days of week vs Hours of day)</span>
              </h3>
              <div className="flex flex-col gap-1 min-w-[320px]">
                {/* Hours Label Header */}
                <div className="flex gap-0.5 pl-5 mb-1 text-[8px] text-gray-500">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <span key={h} className="w-2.5 text-center">{String(h).padStart(2, "0")}</span>
                  ))}
                </div>

                {/* 7 Days Grid rows */}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, d) => {
                  return (
                    <div key={d} className="flex gap-0.5 items-center">
                      <span className="w-5 text-[8px] text-gray-400 shrink-0">{dayName}</span>
                      {Array.from({ length: 24 }).map((_, h) => {
                        const cell = stats?.heatmap?.find((item) => item.day === d && item.hour === h);
                        const count = cell?.count || 0;

                        // Select color depth based on watch frequency
                        let bgClass = "bg-gray-800/20";
                        if (count > 0 && count < 3) bgClass = "bg-purple-900/40 border border-purple-800/20";
                        else if (count >= 3 && count < 6) bgClass = "bg-purple-700/60";
                        else if (count >= 6 && count < 10) bgClass = "bg-purple-500/80";
                        else if (count >= 10) bgClass = "bg-purple-400 shadow-[0_0_4px_#a855f7]";

                        return (
                          <div
                            key={h}
                            title={`${dayName} at ${String(h).padStart(2, "0")}:00 : ${count} watch events`}
                            className={`w-2.5 h-2.5 rounded-sm transition-colors cursor-help ${bgClass}`}
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

        {activeTab === "sync" && (
          <div className="space-y-4 text-xs">
            {/* Stremio Profile Sync / datastoreGet */}
            <div className="bg-[#151622] p-4 rounded-lg border border-gray-800/80 space-y-3">
              <h3 className="font-bold text-gray-300 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-purple-400" /> Stremio Account Sync
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Import your pre-existing watched items directly from the Stremio cloud datastore. We pre-fill your credential if logged in!
              </p>

              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold block">AuthKey / Credentials</label>
                <input
                  type="password"
                  placeholder="Paste Stremio Auth Key or credentials..."
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  className="w-full bg-black/40 border border-gray-800 rounded py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                onClick={handleSync}
                disabled={syncLoading || !authKey.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded py-2 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {syncLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synchronizing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" /> Recover Historical Data
                  </>
                )}
              </button>

              {syncSuccessMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded p-2.5 flex items-start gap-2 text-[11px]">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{syncSuccessMsg}</span>
                </div>
              )}

              {syncError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded p-2.5 flex items-start gap-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{syncError}</span>
                </div>
              )}
            </div>

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
