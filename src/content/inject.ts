// MAIN world content script
// Used to intercept native fetch/XHR calls that happen in the main page context

const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : (input instanceof Request ? input.url : "");

  // If we detect a call to datastorePut, it means Stremio is updating playback state
  if (url.includes("api.strem.io/api/datastorePut")) {
    try {
      let bodyData: any = {};
      if (init && init.body) {
        if (typeof init.body === "string") {
          bodyData = JSON.parse(init.body);
        }
      }

      const response = await originalFetch.apply(this, [input, init]);
      const clone = response.clone();
      const responseData = await clone.json();

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

function extractAndDispatchProfile() {
  try {
    const profileStr = localStorage.getItem("profile");
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      const authKey = profile?.auth?.key || "";
      window.dispatchEvent(
        new CustomEvent("STREMIO_PROFILE_EXTRACTED", {
          detail: { authKey }
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("STREMIO_PROFILE_EXTRACTED", {
          detail: { authKey: "" }
        })
      );
    }
  } catch (e) {
    console.error("[Stremio Insights] Error extracting profile in MAIN world:", e);
    window.dispatchEvent(
      new CustomEvent("STREMIO_PROFILE_EXTRACTED", {
        detail: { authKey: "" }
      })
    );
  }
}

window.addEventListener("REQUEST_STREMIO_PROFILE", () => {
  extractAndDispatchProfile();
});

// Also initial extraction on load
extractAndDispatchProfile();

console.log("[Stremio Insights] MAIN world fetch interceptor injected successfully.");

export {};
