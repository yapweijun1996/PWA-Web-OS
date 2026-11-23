import type { ConnectionState } from '../contracts';

export function observeConnection(listener: (state: ConnectionState) => void): () => void {
  let state: ConnectionState | undefined;
  let pending: AbortController | undefined;
  let nextCheck: number | undefined;

  function publish(next: ConnectionState) {
    if (next === state) return;
    state = next;
    listener(next);
  }

  function cancel() {
    window.clearTimeout(nextCheck);
    pending?.abort();
    pending = undefined;
  }

  async function check() {
    if (!navigator.onLine || document.hidden) {
      cancel();
      if (!navigator.onLine) publish('offline');
      return;
    }
    if (pending) return;
    window.clearTimeout(nextCheck);
    if (!state || state === 'offline') publish('checking');
    const request = new AbortController();
    pending = request;
    const timeout = window.setTimeout(() => request.abort(), 5_000);
    try {
      // The worker only caches GETs. A bodyless HEAD must reach the hosting origin.
      const response = await fetch(import.meta.env.BASE_URL + 'manifest.webmanifest', {
        method: 'HEAD', cache: 'no-store', credentials: 'omit', redirect: 'error',
        referrerPolicy: 'no-referrer', signal: request.signal,
      });
      const mediaType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      const isManifest = mediaType === 'application/manifest+json' || mediaType === 'application/json';
      if (pending === request) publish(response.ok && isManifest ? 'online' : 'unreachable');
    } catch {
      if (pending === request) publish('unreachable');
    } finally {
      window.clearTimeout(timeout);
      if (pending === request) {
        pending = undefined;
        nextCheck = window.setTimeout(check, 60_000);
      }
    }
  }

  window.addEventListener('online', check);
  window.addEventListener('offline', check);
  document.addEventListener('visibilitychange', check);
  publish('checking');
  void check();
  return () => {
    cancel();
    window.removeEventListener('online', check);
    window.removeEventListener('offline', check);
    document.removeEventListener('visibilitychange', check);
  };
}
