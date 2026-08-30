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

      // Use a MessageChannel to securely communicate with the ISOLATED content script
      // without broadcasting sensitive payload data to the global window context.
      const channel = new MessageChannel();
      window.postMessage({ type: "STREMIO_DATASTORE_PUT_INTERCEPTED" }, "*", [channel.port2]);

      channel.port1.postMessage({
        request: bodyData,
        response: responseData
      });

      return response;
    } catch (e) {
      console.error("[Stremio Insights] Error intercepting fetch:", e);
    }
  }

  return originalFetch.apply(this, [input, init]);
};

console.log("[Stremio Insights] MAIN world fetch interceptor injected successfully.");

export {};
