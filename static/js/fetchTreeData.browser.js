// static/js/fetchTreeData.browser.js
(function () {
  "use strict";

  async function tryFetch(url) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        const error = new Error(`Status ${res.status} — ${txt}`);
        error.status = res.status;
        throw error;
      }
      const rawText = await res.text();
      const safeText = rawText.replace(/\bNaN\b/g, "null");
      let json;
      try {
        json = JSON.parse(safeText);
      } catch (e) {
        // fallback to res.json() attempt
        try {
          // we can't re-read response, but some servers had already returned JSON;
          // attempt to parse rawText in another way, otherwise throw
          json = JSON.parse(safeText);
        } catch (e2) {
          throw e;
        }
      }
      return json;
    } catch (err) {
      throw err;
    }
  }

  /**
   * fetchTreeData(excelPath)
   * Tries /api/tree/from-file/ then /tree/from-file/ as fallback.
   * Returns normalized data mapping or null on failure.
   */
  async function fetchTreeData(excelPath = null) {
    const candidates = ["/api/tree/from-file/", "/tree/from-file/"];

    if (excelPath) {
      // If excelPath provided, prefer attaching to each candidate
      for (let i = 0; i < candidates.length; i++) {
        const base = candidates[i];
        const url = `${base}?path=${encodeURIComponent(excelPath)}`;
        try {
          const json = await tryFetch(url);
          if (json != null) {
            if (typeof window.normalizeData === "function") {
              return window.normalizeData(json);
            }
            return json;
          }
        } catch (err) {
          // If 404 specifically, continue to next candidate
          if (err && err.status === 404) continue;
          // other errors — log and continue to try fallback endpoints
          console.warn(`fetchTreeData try ${url} failed:`, err);
        }
      }
    } else {
      for (const base of candidates) {
        try {
          const json = await tryFetch(base);
          if (json != null) {
            if (typeof window.normalizeData === "function") {
              return window.normalizeData(json);
            }
            return json;
          }
        } catch (err) {
          if (err && err.status === 404) {
            // try next candidate
            continue;
          }
          console.warn(`fetchTreeData try ${base} failed:`, err);
        }
      }
    }

    // nothing worked
    console.error("fetchTreeData: all endpoints failed");
    return null;
  }

  // Expose to window
  window.fetchTreeData = fetchTreeData;
})();
