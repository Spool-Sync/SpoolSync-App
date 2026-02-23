/**
 * Version polling service.
 *
 * Fetches the app's index.html with no-cache every `intervalMs` milliseconds
 * and extracts the fingerprinted JS entry-point filename. Because Vite hashes
 * asset names on every build, a different filename means a new deployment is
 * live. When detected, `onNewVersion` is called once and polling stops.
 */

let knownEntry = null;

async function fetchEntry() {
  const res = await fetch('/', { cache: 'no-store' });
  const html = await res.text();
  // Match the hashed main JS bundle Vite emits, e.g. /assets/index-BxQ3aW1c.js
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  return match?.[1] ?? null;
}

export async function startVersionPolling(onNewVersion, intervalMs = 3 * 60 * 1000) {
  try {
    knownEntry = await fetchEntry();
  } catch {
    return; // Can't read current version, skip polling
  }

  if (!knownEntry) return; // Non-hashed build (e.g. dev server) — skip

  const timer = setInterval(async () => {
    try {
      const current = await fetchEntry();
      if (current && current !== knownEntry) {
        clearInterval(timer);
        onNewVersion();
      }
    } catch {
      // Network hiccup — try again next interval
    }
  }, intervalMs);
}
