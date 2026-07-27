# Architecture & Design

This document details the system design, data flows, and structural components of **Stremio Insights**.

---

## 1. Extension Block Diagram

```txt
  +-------------------------------------------------------------------------+
  |                             web.stremio.com                             |
  |                                                                         |
  |   +-----------------------+              +---------------------------+  |
  |   |  MAIN World Content   |              |  ISOLATED World Content   |  |
  |   |  (fetch interceptor)  |              |  (DOM Monitor & Badges)   |  |
  |   +-----------+-----------+              +-------------+-------------+  |
  |               | CustomEvent                            |                |
  |               +========================================>                |
  |                                                        |                |
  |                                                        | sendMessage    |
  +--------------------------------------------------------|----------------+
                                                           |
                                                           v
                                             +-------------+-------------+
                                             |  Background Service Worker|
                                             |  (State Sync & Rehydrate) |
                                             +-------------+-------------+
                                                           |
                                                           | idb / storage
                                                           v
                                             +-------------+-------------+
                                             |  Local IndexedDB Database |
                                             |  (playback_events store)  |
                                             +---------------------------+
```

---

## 2. Component Design & Roles

### MAIN World Content Script (`inject.ts`)
- **Role**: Overrides standard `window.fetch` to intercept Stremio's API requests (specifically `/api/datastorePut` and datastore operations).
- **Execution**: Runs at `document_start` directly inside the main execution thread of the page.
- **Message passing**: Dispatches a standard `CustomEvent` loaded with captured request data to relay it to the isolated context.

### ISOLATED World Content Script (`index.ts`)
- **Role**: Orchestrates DOM element queries and UI rendering.
- **Execution**: Runs in the isolated extension world. It:
  - Manages a singular, high-performance `MutationObserver` on `document.documentElement`.
  - Attaches standard HTML5 video event listeners to the current `<video>` tag to track playback, progress percentage, duration, and completed views.
  - Queries all card elements to inject visual statistics badges (Last watched, Watch counts, and maximum Progress).
  - Mounts the sliding React Sidebar directly into `document.body` and binds it to a glowing float toggle button.

### Background Service Worker (`background/index.ts`)
- **Role**: Coordination, synchronization, and persistence.
- **Execution**: Runs in the background of Chrome. It is stateless (conforming to Manifest V3) and:
  - Listens to incoming playback event logs from content scripts and performs **upserts** in IndexedDB to support real-time progress updates without duplicating history.
  - Initiates cloud recovery sync with Stremio's Datastore API (`/api/datastoreGet`) to load historical watched library items.
  - Computes rich analytics summaries and heatmap statistics.
  - Executes CSV/JSON exports.

### Zustand State Store (`hooks/useInsightsStore.ts`)
- **Role**: Coordinates state sharing across all React UI views (Sidebar drawer, Popup menu, and Options panels).
- **Behavior**: Calls `chrome.runtime.sendMessage` to fetch events, request cloud syncing, and filter playback history dynamically in real time.
