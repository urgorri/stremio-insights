# Changelog

All notable changes to the Stremio Insights extension will be documented in this file.

---

## [1.0.0] - 2026-07-27

### Added
- **Reverse Engineering**: Created standard reverse-engineering documentation of `web.stremio.com` localStorage, hash routing, APIs, and mutation observers.
- **IndexedDB Persistence**: Integrated robust storage using the `idb` library to persist historical playback events, stats, and metadata cache.
- **Stateless Service Worker**: Created a lightweight background worker for real-time upserts, state management, and synchronization.
- **API History Recovery**: Integrated automatic import of previous watches and library configurations from the Stremio cloud Datastore (`/api/datastoreGet`).
- **Fetch Interception**: Injected a MAIN world fetch interceptor to capture datastore updates.
- **DOM Badges**: Injected real-time progress (%), watch count, and last watched date badges on all movie and series catalog cards using a singular root `MutationObserver`.
- **Sliding React Sidebar**: Created a beautiful, slidable React drawer directly embedded inside the Stremio interface.
- **Popup & Options Panels**: Built unified popup and spacious options panels featuring fully detailed statistics, timelines, and synchronization menus.
- **Heatmap & Analytics**: Added interactive watch heatmaps (days vs. hours), activity line metrics, and top lists (Genres, Years, and Directors).
- **Hierarchical Timelines**: Grouped playback events into yearly/monthly collapsible visual nodes.
- **Exporters**: Added native downloads for both CSV and JSON formats.
- **High-Coverage Test Suite**: Achieved 94.59% test coverage with comprehensive unit tests for calculations, date formatters, and exporters.
