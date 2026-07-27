# Installation Guide

Follow these instructions to install, build, and run the Stremio Insights extension.

## Prerequisites

Make sure you have the following installed:
- **Node.js** (v22 or higher)
- **pnpm** (v10 or higher)
- **Google Chrome** (or any Chromium-based browser like Brave, Edge, Opera)

---

## 1. Local Development Setup

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd stremio-insights
   ```

2. Install the package dependencies using `pnpm`:
   ```bash
   pnpm install
   ```

3. Start the Vite development server with hot-reload:
   ```bash
   pnpm dev
   ```

---

## 2. Production Build

To compile and bundle the extension for publishing or installation:

1. Run the build command:
   ```bash
   pnpm build
   ```
   This will bundle all React assets, Popup/Options, background Service Workers, and Content Scripts into the local `dist/` directory.

---

## 3. Loading the Extension in Google Chrome

To install the unpacked extension into Chrome:

1. Open a new tab in Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on the **Developer mode** switch at the top-right corner.
3. Click the **Load unpacked** button at the top-left corner.
4. Select the **`dist/`** directory in the project root folder.
5. The Stremio Insights extension icon should now appear in your extension toolbar.

---

## 4. Usage on Stremio Web

1. Go to `https://web.stremio.com/`.
2. Ensure you are logged in to your Stremio profile.
3. You will see a glowing **Insights** button float on the bottom-right corner of the screen.
4. Click **Insights** to open your native sidebar dashboard!
5. Open any card page to view injected viewing badges automatically.
6. Start playing any content to capture real-time viewing timeline logs.
