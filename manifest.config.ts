import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest(async (env) => ({
  manifest_version: 3,
  name: "Stremio Insights",
  version: "1.0.0",
  description: "Complete watch history, analytics, search, and badges for web.stremio.com.",
  permissions: ["storage", "activeTab"],
  host_permissions: ["https://web.stremio.com/*"],
  action: {
    default_popup: "index.html",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://web.stremio.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_end"
    },
    {
      matches: ["https://web.stremio.com/*"],
      js: ["src/content/inject.ts"],
      run_at: "document_start",
      world: "MAIN"
    }
  ],
  options_page: "options.html",
  web_accessible_resources: [
    {
      resources: ["icons/icon16.png", "icons/icon48.png", "icons/icon128.png"],
      matches: ["https://web.stremio.com/*"]
    }
  ]
}));
