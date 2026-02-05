export const CONFIG = {
  OVERPASS_ENDPOINT: 'https://overpass-api.de/api/interpreter',
  BUSY_HINTS: ['Dispatcher_Client', 'too busy', 'timeout', 'rate limit'],
  REQUEST_TIMEOUT_MS: 120000,
  MAX_WAIT_SEARCH_MS: 180000,
  MAX_WAIT_GEOM_MS: 600000,
  RETRY_BASE_DELAY_MS: 3000,
  RETRY_MAX_DELAY_MS: 20000
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isBusyResponse(text, status) {
  if ([429, 502, 503, 504].includes(status)) return true;
  const lower = text.toLowerCase();
  return CONFIG.BUSY_HINTS.some(hint => lower.includes(hint.toLowerCase()));
}

export async function searchNominatim(query) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=10`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Nominatim ist ausgelastet. Bitte versuche es gleich erneut.');
    }
    throw new Error('Fehler beim Abruf der Suche.');
  }

  return response.json();
}

export async function fetchOverpassJson(query, options = {}) {
  const {
    maxWaitMs = CONFIG.MAX_WAIT_SEARCH_MS,
    requestTimeoutMs = CONFIG.REQUEST_TIMEOUT_MS,
    onWaitMessage = () => {}
  } = options;

  const start = Date.now();
  let attempt = 0;

  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed >= maxWaitMs) {
      throw new Error('Die Abfrage dauert zu lange und wurde abgebrochen.');
    }

    const remainingMs = maxWaitMs - elapsed;
    attempt += 1;
    const controller = new AbortController();
    const effectiveTimeoutMs = Math.min(requestTimeoutMs, remainingMs);
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);
    let text = '';
    let status = 0;

    try {
      const response = await fetch(CONFIG.OVERPASS_ENDPOINT, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: controller.signal
      });
      status = response.status;
      text = await response.text();
    } catch (err) {
      if (Date.now() - start >= maxWaitMs) {
        throw new Error('Die Abfrage dauert zu lange und wurde abgebrochen.');
      }
      const waitMs = Math.min(CONFIG.RETRY_BASE_DELAY_MS * attempt, CONFIG.RETRY_MAX_DELAY_MS);
      onWaitMessage(`Verbindung unterbrochen. Warte ${Math.round(waitMs / 1000)}s...`);
      await sleep(Math.min(waitMs, maxWaitMs - (Date.now() - start)));
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    try {
      return JSON.parse(text);
    } catch {
      if (isBusyResponse(text, status)) {
        if (Date.now() - start >= maxWaitMs) {
          throw new Error('Die Abfrage dauert zu lange und wurde abgebrochen.');
        }
        const waitMs = Math.min(CONFIG.RETRY_BASE_DELAY_MS * attempt, CONFIG.RETRY_MAX_DELAY_MS);
        onWaitMessage(`Server beschäftigt. Warte ${Math.round(waitMs / 1000)}s...`);
        await sleep(Math.min(waitMs, maxWaitMs - (Date.now() - start)));
        continue;
      }
      const cleanError = text.replace(/<\/?[^>]+(>|$)/g, '').trim();
      throw new Error(`Server-Fehler:\n${cleanError.substring(0, 200)}`);
    }
  }
}
