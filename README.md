# Stremio Insights

[![CI](https://github.com/urgorri/stremio-insights/actions/workflows/ci.yml/badge.svg)](https://github.com/urgorri/stremio-insights/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Privacy Policy](https://img.shields.io/badge/Privacy-Policy-green.svg)](https://urgorri.github.io/stremio-insights/)
[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](https://github.com/urgorri/stremio-insights)

Bring a real watch history, analytics, and statistics dashboard to Stremio.

Stremio Insights is an open-source Chrome Extension built with React 19, TypeScript, and Manifest V3 that enhances the `web.stremio.com` experience by providing detailed viewing history, timelines, statistics, background synchronization, full-screen options dashboards, and native export capabilities.

> Stremio gives you "Continue Watching". Stremio Insights gives you your entire story.

---

## Privacy & Data Security

Stremio Insights is designed with a **100% local-first architecture**. All playback history, statistics, and metadata repairs are stored directly inside your browser using IndexedDB and Chrome Local Storage. Your private viewing history is never collected, tracked, or transmitted to any external analytics server.

For complete compliance details, read the official [Stremio Insights Privacy Policy](https://urgorri.github.io/stremio-insights/).

---

## Features

### Viewing History & Badges

* Last watched date and time.
* Watch count & percentage progress.
* Movie and TV Series support.
* IMDb ID detection and Cinemeta / OMDb automatic metadata enrichment.
* Interactive timeline view.

### Analytics & Heatmaps

* Total movies & TV series watched.
* Most watched titles.
* Activity heatmaps (Month vs. Day).
* Favorite genres, directors, and release years.
* Estimated watch time calculations.

### Flexible Interface & Synchronization

* **Full-Screen Options Dashboard**: Instant full-tab view accessible via the extension popup navbar.
* **On-Demand & Background Sync**: Seamless background synchronization with Stremio without stealing tab focus.
* **Native Injected Sidebar**: Slidable drawer embedded directly into `web.stremio.com`.
* **100% Local Privacy**: All watch data stored locally in browser IndexedDB & Chrome Local Storage.

### Export

* Native CSV export.
* Native JSON export.

---

## Tech Stack

| Category         | Technology                    |
| ---------------- | ----------------------------- |
| Language         | TypeScript 5                  |
| Frontend         | React 19                      |
| Build Tool       | Vite + CRXJS                  |
| Styling          | TailwindCSS                   |
| State Management | Zustand                       |
| Storage          | Chrome Local Storage / IDB    |
| Browser APIs     | Chrome Extensions Manifest V3 |
| Testing          | Vitest + React Testing Library|
| Package Manager  | npm / pnpm                    |

---

## Project Structure

```txt
src/
├── analytics/     # Analytics calculations & heatmaps
├── background/    # Manifest V3 service worker
├── components/    # React dashboard components & UI
├── content/       # Content scripts & fetch interceptors
├── hooks/         # Zustand store & extension hooks
├── options/       # Full-screen options page
├── popup/         # Extension popup entry point
├── types/         # TypeScript interfaces
└── utils/         # Date, export & hash utilities
```

---

## Getting Started

### Install dependencies

```bash
npm install
```

### Start development mode

```bash
npm run dev
```

### Run unit tests

```bash
npm test
```

### Build extension bundle

```bash
npm run build
```

---

## Chrome Installation

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

---

## Release Status & Features

* [x] **v1.0.0**: Native sidebar, DOM badges, IndexedDB storage, stats engine, CSV/JSON export.
* [x] **v1.0.1**: GitHub Actions CI workflow, Vitest test suite with 94%+ coverage.
* [x] **v1.0.2**: Chrome Web Store release build, full-screen options button, seamless background tab sync, updated manifest.

---

## License

MIT

---

## Disclaimer

Stremio Insights is an independent open-source project and is not affiliated with, endorsed by, or maintained by the Stremio team.

All trademarks belong to their respective owners.
