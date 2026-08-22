# Stremio Insights

Bring a real watch history, analytics, and statistics dashboard to Stremio.

Stremio Insights is a Chrome Extension built with React, TypeScript, and Manifest V3 that enhances the `web.stremio.com` experience by providing detailed viewing history, timelines, statistics, and export capabilities.

> Stremio gives you "Continue Watching". Stremio Insights gives you your entire story.

---

## Features

### Viewing History

* Last watched date and time.
* Watch count.
* Viewing progress.
* Movie and TV Series support.
* IMDb ID detection.
* Timeline view.

### Analytics

* Total movies watched.
* Total TV series watched.
* Most watched titles.
* Activity by month and year.
* Favorite genres.
* Favorite directors.
* Estimated watch time.

### Integration

* Native integration with `web.stremio.com`.
* Automatic metadata discovery.
* DOM observation using `MutationObserver`.
* IndexedDB persistence.

### Export

* CSV export.
* JSON export.

---

## Tech Stack

| Category         | Technology                    |
| ---------------- | ----------------------------- |
| Language         | TypeScript                    |
| Frontend         | React 19                      |
| Build Tool       | Vite                          |
| Styling          | TailwindCSS                   |
| State Management | Zustand                       |
| Storage          | IndexedDB                     |
| Browser APIs     | Chrome Extensions Manifest V3 |
| Testing          | Vitest + Playwright           |
| Package Manager  | pnpm                          |

---

## Project Structure

```txt
src/
├── background/
├── content/
├── popup/
├── sidebar/
├── options/
├── components/
├── hooks/
├── services/
│   └── stremio/
├── storage/
├── types/
└── utils/
```

---

## Getting Started

### Install dependencies

```bash
pnpm install
```

### Start development mode

```bash
pnpm dev
```

### Build extension

```bash
pnpm build
```

---

## Chrome Installation

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

---

## Planned Features

### Version 0.1

* [ ] Last watched badge.
* [ ] Viewing history.
* [ ] CSV export.

### Version 0.2

* [ ] Timeline view.
* [ ] Statistics dashboard.
* [ ] Search and filters.

### Version 0.3

* [ ] Watch count.
* [ ] Estimated watch time.
* [ ] Activity heatmap.

### Version 1.0

* [ ] Chrome Web Store release.
* [ ] Firefox support.
* [ ] Optional synchronization.

---

## Architecture

```txt
web.stremio.com
        ↓
Content Script
        ↓
MutationObserver
        ↓
Metadata Parser
        ↓
IndexedDB
        ↓
Sidebar UI
        ↓
Analytics Engine
```

---

## Development Principles

* No external APIs.
* No backend required.
* Type-safe codebase.
* Open source.
* Privacy first.
* Local-only data storage.

---

## Privacy Policy & GitHub Pages

The official Privacy Policy website for **Stremio Insights** is included directly in this repository under the [`/docs`](docs/index.html) directory.

To host the Privacy Policy on GitHub Pages:
1. Go to **Settings > Pages** in your GitHub repository.
2. Select **Source**: `Deploy from a branch`.
3. Choose branch `main` and folder `/docs`.
4. Click **Save**.

Your Privacy Policy will be live at `https://<username>.github.io/stremio-insights/`.

---

## License

MIT

---

## Disclaimer

Stremio Insights is an independent project and is not affiliated with, endorsed by, or maintained by the Stremio team.

All trademarks belong to their respective owners.
