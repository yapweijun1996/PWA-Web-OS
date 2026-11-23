/// <reference lib="webworker" />

// Vite prepends this config and transpiles this standalone classic worker.
declare const release: {
  buildId: string;
  base: string;
  files: [path: string, integrity: string][];
  startup: string[];
};

{
  type WorkerRequest = import('../src/pwa/protocol').WorkerRequest;
  type WorkerReply = import('../src/pwa/protocol').WorkerInspection | import('../src/pwa/protocol').ActivationReply;
  const worker = globalThis as unknown as ServiceWorkerGlobalScope;
  const prefix = 'pwa-web-os:release:';
  const cacheName = prefix + release.buildId;
  const absolute = (path: string) => new URL(release.base + path, worker.location.origin).href;
  const index = absolute('index.html');
  // Worker-only metadata, outside the routes served from CacheStorage.
  const retentionKey = absolute('.pwa-previous-releases');
  const assets = new Map(release.files.map(([path, integrity]) => [absolute(path), integrity]));
  const startup = release.startup.map(absolute);
  const inScope = (url: URL) => url.origin === worker.location.origin && url.pathname.startsWith(release.base);
  const cached = (url: string) => caches.match(url, { cacheName });
  const currentClients = new Set<string>();
  const isOtherRelease = (key: string) => key.startsWith(prefix) && key !== cacheName;

  async function previousReleases(): Promise<string[]> {
    const metadata = await cached(retentionKey);
    return metadata ? (await metadata.json() as string[]).filter(isOtherRelease) : [];
  }

  async function retireOldReleases(windows: WindowClient[]): Promise<void> {
    const live = new Set(windows.map(({ id }) => id));
    for (const id of currentClients) if (!live.has(id)) currentClients.delete(id);
    // If the worker restarts, unconfirmed clients keep the old caches until they identify themselves again.
    if (windows.some(({ id }) => !currentClients.has(id))) return;
    const old = await previousReleases();
    if (worker.registration.installing || worker.registration.waiting) return;
    await Promise.all(old.map((key) => caches.delete(key)));
  }

  async function versionedAsset(request: Request): Promise<Response> {
    // Previously loaded documents may still request their hashed bundles and named wallpapers.
    for (const cacheName of await previousReleases()) {
      const response = await caches.match(request, { cacheName });
      if (response) return response;
    }
    return fetch(request);
  }

  async function complete(): Promise<boolean> {
    return (await Promise.all([...assets.keys()].map(cached))).every(Boolean);
  }

  function releaseRequest(url: string, integrity: string, signal?: AbortSignal) {
    return new Request(url, { cache: 'reload', redirect: 'error', integrity, signal });
  }

  let repairing: Promise<boolean> | undefined;
  function repairRelease(): Promise<boolean> {
    repairing ??= restoreMissing().finally(() => { repairing = undefined; });
    return repairing;
  }

  async function restoreMissing(): Promise<boolean> {
    const abort = new AbortController();
    const deadline = worker.setTimeout(() => abort.abort(), 7_000);
    try {
      const cache = await caches.open(cacheName);
      const missing = await Promise.all([...assets].map(async ([url, integrity]) =>
        await cache.match(url) ? undefined : releaseRequest(url, integrity, abort.signal)
      ));
      // Add missing files atomically. A partial or newer hosted release must not replace healthy entries.
      await cache.addAll(missing.filter((request): request is Request => request !== undefined));
      return await complete();
    } catch {
      return false;
    } finally {
      worker.clearTimeout(deadline);
    }
  }

  async function navigate(): Promise<Response> {
    // Keep a bootable cached document on its own build while any update waits.
    const [shell, ...dependencies] = await Promise.all([index, ...startup].map(cached));
    if (shell && dependencies.every(Boolean)) return shell;
    if (await repairRelease()) {
      const restored = await cached(index);
      if (restored) return restored;
    }

    // The old shell may point to files no longer present on the host after a deployment.
    const abort = new AbortController();
    const deadline = worker.setTimeout(() => abort.abort(), 5_000);
    try {
      const hosted = await fetch(index, { cache: 'no-store', redirect: 'error', signal: abort.signal });
      if (hosted.ok) return hosted;
    } catch { /* The recovery page works without any release assets. */ }
    finally { worker.clearTimeout(deadline); }

    const chinese = worker.navigator.language.toLowerCase().startsWith('zh');
    const title = chinese ? '工作区暂时无法打开' : 'Workspace temporarily unavailable';
    const instructions = chinese ? '连接网络后，重新打开工作区。' : 'Connect to the internet, then reopen the workspace.';
    const reopen = chinese ? '重新打开工作区' : 'Reopen workspace';
    return new Response(`<!doctype html><html lang="${chinese ? 'zh-Hans' : 'en'}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><main><h1>${title}</h1><p>${instructions}</p><a href="${release.base}">${reopen}</a></main></html>`, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  async function install(): Promise<void> {
    // Never touch the active release's cache when preparing a distinct build.
    try {
      // Snapshot only earlier releases. Later candidates must never become eligible for cleanup.
      const old = (await caches.keys()).filter(isOtherRelease);
      const cache = await caches.open(cacheName);
      // addAll commits atomically, and integrity rejects stale deployment files and HTML fallbacks.
      await cache.addAll([...assets].map(([url, integrity]) => releaseRequest(url, integrity)));
      if (!await complete()) throw new Error('Incomplete release');
      await cache.put(retentionKey, new Response(JSON.stringify(old)));
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  }

  worker.addEventListener('install', (event) => event.waitUntil(install()));
  worker.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      if (!await complete()) throw new Error('Incomplete release');
      // Claiming a client changes its controller, not the build already running in its document.
      await worker.clients.claim();
    })());
  });

  worker.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || !inScope(url)) return;
    if (request.mode === 'navigate') {
      event.respondWith(navigate());
      return;
    }
    const integrity = assets.get(request.url);
    if (integrity) {
      event.respondWith(cached(request.url).then(response =>
        response ?? fetch(releaseRequest(request.url, integrity))
      ));
    } else if (url.pathname.startsWith(release.base + 'assets/') || url.pathname.startsWith(release.base + 'wallpapers/')) {
      event.respondWith(versionedAsset(request));
    }
  });

  worker.addEventListener('message', (event) => {
    const source = event.source;
    const port = event.ports[0];
    const message = event.data as WorkerRequest | undefined;
    if (!port || !source || !('id' in source) || !inScope(new URL(source.url)) || !message) return;
    const reply = (data: WorkerReply) => port.postMessage(data);
    event.waitUntil((async () => {
      const onCurrentBuild = message.type === 'inspect' && message.documentBuildId === release.buildId;
      let ready = await complete();
      if (!ready && onCurrentBuild && message.repairMissing) {
        ready = await repairRelease();
      }
      if (onCurrentBuild) currentClients.add(source.id);
      const windows = (await worker.clients.matchAll({ type: 'window', includeUncontrolled: true }))
        .filter((client) => inScope(new URL(client.url)));
      const peers = windows.filter((client) => client.id !== source.id).map((client) => client.id);
      if (message.type === 'inspect') {
        if (ready && onCurrentBuild) await retireOldReleases(windows).catch(() => { /* Keep old caches on cleanup failure. */ });
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
