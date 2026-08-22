# Changelog

All notable changes to the Stremio Insights extension will be documented in this file.

---

## [1.0.2] - 2026-08-22

### Added
- **Full Page Options Navigation**: Added a dedicated "Open full page" button (`Maximize2`) to the popup extension header bar for instant navigation to full-screen options tab (`options.html`).
- **Seamless Background Synchronization**: Updated background service worker and extension popup auto-sync so synchronization communicates directly with Stremio in the background without stealing active tab focus or forcing window focus.
- **Chrome Web Store Release Readiness**: Added automated GitHub Actions CI workflow, expanded unit test suite to 128 tests (94%+ code coverage), and updated Manifest V3 configurations.

### Security & Maintenance
- **Dependency Audit & Vulnerability Remediation**: Resolved all security vulnerabilities (0 remaining) by upgrading `happy-dom` to `^20.0.0`, `vite` to `^6.4.3` (updating `esbuild` to `0.25.12`), and `vitest` with `@vitest/coverage-v8` to `^4.1.11`.
- **Deprecation Warning Resolution**: Upgraded `recharts` to `^3.0.0` and eliminated legacy `glob@10.5.0` dependency paths to clear all npm deprecation warnings.
- **Script Security Approvals**: Approved `esbuild` script execution rules in `package.json` to resolve npm `allow-scripts` warnings.

---

## [1.0.1] - 2026-08-22

### Added
- **GitHub Open Source Baseline**: Configured GitHub Actions CI pipeline for automated type checking, builds, and test coverage.
- **Comprehensive Unit Testing**: Added unit tests for options page, extension popup, content script sync pipeline, OMDb fallbacks, and metadata repairs.

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
