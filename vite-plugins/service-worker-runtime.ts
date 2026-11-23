/// <reference lib="webworker" />

// Vite prepends this config and transpiles this standalone classic worker.
declare const release: {
  buildId: string;
  base: string;
  files: [path: string, integrity: string][];
};

{
  type WorkerRequest = import('../src/pwa/protocol').WorkerRequest;
  type WorkerReply = import('../src/pwa/protocol').WorkerInspection | import('../src/pwa/protocol').ActivationReply;
  const worker = globalThis as unknown as ServiceWorkerGlobalScope;
  const prefix = 'pwa-web-os:release:';
  const cacheName = prefix + release.buildId;
  const absolute = (path: string) => new URL(release.base + path, worker.location.origin).href;
  const index = absolute('index.html');
  const assets = new Map(release.files.map(([path, integrity]) => [absolute(path), integrity]));
  const inScope = (url: URL) => url.origin === worker.location.origin && url.pathname.startsWith(release.base);
  const cached = (url: string) => caches.match(url, { cacheName });

  async function complete(): Promise<boolean> {
    return (await Promise.all([...assets.keys()].map(cached))).every(Boolean);
  }

  async function install(): Promise<void> {
    // Never touch the active release's cache when preparing a distinct build.
    try {
      const cache = await caches.open(cacheName);
      // addAll commits atomically, and integrity rejects stale deployment files and HTML fallbacks.
      await cache.addAll([...assets].map(([url, integrity]) =>
        new Request(url, { cache: 'reload', redirect: 'error', integrity }),
      ));
      if (!await complete()) throw new Error('Incomplete release');
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  }

  worker.addEventListener('install', (event) => event.waitUntil(install()));
  worker.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      if (!await complete()) throw new Error('Incomplete release');
      const old = (await caches.keys()).filter((key) => key.startsWith(prefix) && key !== cacheName);
      // Don't remove a candidate if another update has already started installing.
      if (!worker.registration.installing && !worker.registration.waiting) {
        await Promise.all(old.map((key) => caches.delete(key)));
      }
      await worker.clients.claim();
    })());
  });

  worker.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || !inScope(new URL(request.url))) return;
    // Pin navigations to the controlling build, even if the origin now serves a new release.
    const key = request.mode === 'navigate' ? index : request.url;
    if (assets.has(key)) event.respondWith(cached(key).then((response) => response ?? fetch(request)));
  });

  worker.addEventListener('message', (event) => {
    const source = event.source;
    const port = event.ports[0];
    const message = event.data as WorkerRequest | undefined;
    if (!port || !source || !('id' in source) || !inScope(new URL(source.url)) || !message) return;
    const reply = (data: WorkerReply) => port.postMessage(data);
    event.waitUntil((async () => {
      const ready = await complete();
      const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const peers = windows.filter((client) => client.id !== source.id && inScope(new URL(client.url)))
        .map((client) => client.id);
      if (message.type === 'inspect') {
        reply({ type: 'inspection', buildId: release.buildId, ready, clientId: source.id, peers });
      } else if (message.type === 'activate') {
        if (!ready || message.buildId !== release.buildId || !Array.isArray(message.readyClients)) {
          reply({ type: 'activation', result: 'failed' });
        } else if (peers.some((id) => !message.readyClients.includes(id))) {
          // A tab opened during preparation has not flushed; defer rather than strand it.
          reply({ type: 'activation', result: 'other_client' });
        } else {
          await worker.skipWaiting();
          reply({ type: 'activation', result: 'accepted' });
        }
      }
    })().catch(() => reply({ type: 'activation', result: 'failed' })));
  });
}
