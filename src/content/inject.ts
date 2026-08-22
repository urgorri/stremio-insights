// MAIN world content script
// Used to intercept native fetch/XHR calls that happen in the main page context

function sanitizeData(data: unknown): unknown {
  if (data === null || typeof data !== "object") {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }
  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(data as Record<string, any>)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    cleanObj[key] = sanitizeData((data as Record<string, any>)[key]);
  }
  return cleanObj;
}

function validateAndSanitizeObject(data: unknown): Record<string, any> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return sanitizeData(data) as Record<string, any>;
}

const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : (input instanceof Request ? input.url : "");

  // If we detect a call to datastorePut, it means Stremio is updating playback state
  if (url.includes("api.strem.io/api/datastorePut")) {
    try {
      let bodyData: Record<string, any> = {};
      if (init && init.body) {
        if (typeof init.body === "string") {
          const parsed = JSON.parse(init.body);
          bodyData = validateAndSanitizeObject(parsed);
        }
      }

      const response = await originalFetch.apply(this, [input, init]);
      const clone = response.clone();
      const rawJson = await clone.json();
      const responseData = validateAndSanitizeObject(rawJson);

      // Dispatch a custom event to communicate with the ISOLATED content script
      window.dispatchEvent(new CustomEvent("STREMIO_DATASTORE_PUT_INTERCEPTED", {
        detail: {
          request: bodyData,
          response: responseData
        }
      }));

      return response;
    } catch (e) {
      console.error("[Stremio Insights] Error intercepting fetch:", e);
    }
  }

  return originalFetch.apply(this, [input, init]);
};

console.log("[Stremio Insights] MAIN world fetch interceptor injected successfully.");

export {};
