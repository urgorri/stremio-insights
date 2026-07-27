# REVERSE ENGINEERING: web.stremio.com

This document describes the storage keys, internal API endpoints, DOM selectors, mutation patterns, and player lifecycle events of the Stremio Web application, gathered through research and source analysis.

---

## 1. Storage Usage

Stremio Web uses `localStorage`, `sessionStorage`, and `IndexedDB` to maintain profile, settings, addons, and library/progress cache.

### localStorage Keys

- `profile`: Contains the user session details, including authorization credentials and general configuration.
  - Structure:
    ```json
    {
      "auth": {
        "key": "STREMIO_AUTH_KEY_STRING",
        "user": {
          "id": "USER_ID_STRING",
          "email": "USER_EMAIL_STRING"
        }
      }
    }
    ```
- `library`: A list or cache of library items synced from Stremio cloud.
- `settings`: Local player, interface, and stream settings.

### IndexedDB

Stremio's internal state engine runs in a Web Worker (stremio-core compiled to WASM). The core uses IndexedDB under the database name `stremio-core` or similar to persist local caches.

---

## 2. Internal APIs

Stremio Web syncs with the Stremio Datastore API hosted at `https://api.strem.io`.

### Key Endpoints

#### 1. POST `/api/login`
- **Purpose**: Authenticates user.
- **Response**: Returns profile containing `authKey`.

#### 2. POST `/api/addonCollectionGet`
- **Purpose**: Retrieves installed addons/catalogs.

#### 3. POST `/api/datastoreGet`
- **Purpose**: Retrieves library items, history, and watch progress.
- **Request Body**:
  ```json
  {
    "authKey": "STREMIO_AUTH_KEY",
    "collection": "library"
  }
  ```
- **Response Shape**: An array of library objects:
  ```json
  {
    "result": [
      {
        "_id": "tt1234567",
        "name": "Title Name",
        "type": "movie", // or "series"
        "poster": "https://...",
        "state": {
          "lastWatched": "2026-07-25T22:31:00.000Z",
          "timesWatched": 3,
          "timeWatched": 5100000, // in ms
          "duration": 6000000, // in ms
          "video_id": "tt1234567", // or "tt1234567:2:6"
          "watched": "tt1234567:2:6:12:encoded..."
        }
      }
    ]
  }
  ```

#### 4. POST `/api/datastorePut`
- **Purpose**: Saves library items, history, and watch progress.

---

## 3. DOM Selectors & Routing

### URL Hash Routes

Stremio Web uses Hash routing:
- **Board/Home**: `#/board`
- **Discover**: `#/discover`
- **Library**: `#/library`
- **Detail Page**: `#/detail/{type}/{id}` (e.g. `#/detail/movie/tt1234567` or `#/detail/series/tt7654321`)
- **Player Page**: `#/player/{transport}/{type}/{id}/{video_id}` (e.g. `#/player/local/movie/tt1234567/tt1234567` or `#/player/local/series/tt7654321/tt7654321:1:1`)

### DOM Selectors

- **Card elements**: `.card-container`, `.meta-item`, or elements representing catalog items. We can identify cards with `data-id` or standard anchor tags containing a `href` pattern like `#/detail/{type}/{id}`.
- **Player container**: `.player-container` or `video` tag.
- **Video tag**: `<video>` handles actual streams.

---

## 4. Mutation Patterns

We observe changes in Stremio's DOM using a singular root `MutationObserver`:
- **Card Badges Injection**: When navigation changes or a catalog is rendered, `.card-container` or elements matching catalog items are inserted. We query for anchor links containing `#/detail/{type}/{id}` to find the relevant IMDb ID, type, and poster, then inject visual badges (Last watched, Watch count, Progress) underneath or overlaid on the poster.
- **Player Lifecycle**: When the player path matches `#/player/*`, a video element or player wrapper becomes available in the DOM. We track `<video>` element events (`play`, `pause`, `timeupdate`, `ended`) to log playback.

---

## 5. Limitations

- Stremio does not store full chronological history natively (it only stores the last watched timestamp, timesWatched watch count, and current progress for each item in its Datastore).
- To overcome this, our extension must:
  - Initialize history by importing the Stremio datastore (`api/datastoreGet`) at install time.
  - Intercept fetch requests and watch for standard player events (`play`, `pause`, `timeupdate`, `ended`) to record each playback event locally in our local IndexedDB database, preserving a true timeline of *every* viewing session.
