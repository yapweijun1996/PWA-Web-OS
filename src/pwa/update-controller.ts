/// <reference types="vite/client" />
import type { FlushResult, UpdateController, UpdateState } from '../contracts';
import type { PeerMessage } from './protocol';
import { bounded, collectVotes, inspectWorker, requestWorker, stepTimeout, waitForControl } from './worker-client';

declare const __BUILD_ID__: string;

type Release = { worker: ServiceWorker; buildId: string };
type Attempt = { id: string; stop: AbortController; unlock: () => void };
type Peer = { attempt: Attempt; target: Release; ready: boolean; timer: ReturnType<typeof setTimeout> };

const reloadKey = 'pwa-web-os:reload-target';
let singleton: UpdateController | undefined;

declare global {
  interface Window {
    // Release diagnostics only. No editor, storage or note data is exposed.
    __pwaUpdate?: Pick<UpdateController, 'getState' | 'isOfflineReady' | 'accept' | 'retry'> & { buildId: string };
  }
}

export function createUpdateController(): UpdateController {
  if (singleton) return singleton;
  const sw = import.meta.env.PROD && typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  const base = import.meta.env.BASE_URL;
  let channel: BroadcastChannel | undefined;
  let registration: ServiceWorkerRegistration | undefined;
  let registering = false;
  let candidate: Release | undefined;
  let attempt: Attempt | undefined;
  let peer: Peer | undefined;
  let clientId: string | undefined;
  let flush: (() => Promise<FlushResult>) | undefined;
  let state: UpdateState = { status: 'idle' };
  let offlineReady = false;
  let readinessCheck = 0;
  const listeners = new Set<(state: UpdateState) => void>();
  const offlineListeners = new Set<(ready: boolean) => void>();

  function publish(next: UpdateState) {
    if (next.status === state.status && next.detail === state.detail) return;
    state = next;
    for (const listener of listeners) listener(next);
  }

  function setOffline(ready: boolean) {
    if (ready === offlineReady) return;
    offlineReady = ready;
    for (const listener of offlineListeners) listener(ready);
  }

  async function refreshOffline() {
    const check = ++readinessCheck;
    const worker = sw?.controller;
    if (!worker) return setOffline(false);
    const info = await inspectWorker(worker);
    if (sw?.controller !== worker || check !== readinessCheck) return;
    if (info) clientId = info.clientId;
    setOffline(info?.ready === true && info.buildId === __BUILD_ID__);
    if (info?.buildId === __BUILD_ID__ && !info.ready && navigator.onLine) {
      const repaired = await inspectWorker(worker, undefined, true);
      if (sw?.controller !== worker || check !== readinessCheck) return;
      setOffline(repaired?.ready === true && repaired.buildId === __BUILD_ID__);
    }
    if (!attempt && !registration?.waiting && info?.ready && info.buildId !== __BUILD_ID__) {
      publish({ status: 'failed', detail: 'reload_pending' });
    }
  }

  async function refreshCandidate(force = false) {
    if (attempt) return;
    const worker = registration?.waiting;
    if (!worker || worker.state !== 'installed') {
      candidate = undefined;
      if (state.status === 'available') publish({ status: 'idle' });
      return;
    }
    const info = await inspectWorker(worker);
    if (attempt || registration?.waiting !== worker || worker.state !== 'installed') return;
    if (info) clientId = info.clientId;
    if (!info?.ready) {
      candidate = undefined;
      publish({ status: 'failed', detail: 'activation_failed' });
    } else if (info.buildId !== __BUILD_ID__ || (sw?.controller && sw.controller !== worker)) {
      // A recovery navigation can already be running these bytes under the older worker.
      const unchanged = candidate?.worker === worker;
      candidate = { worker, buildId: info.buildId };
      if (!unchanged) worker.addEventListener('statechange', () => {
        if (candidate?.worker !== worker) return;
        candidate = undefined;
        if (!attempt && state.status === 'available') publish({ status: 'idle' });
        void refreshCandidate();
      }, { once: true });
      if (!unchanged || force) publish({ status: 'available' });
    } else {
      candidate = undefined;
      if (state.status === 'available') publish({ status: 'idle' });
    }
  }

  function checkForUpdates() {
    void refreshOffline();
    void refreshCandidate();
    void registration?.update().then(() => {
      if (state.detail === 'check_failed') publish({ status: 'idle' });
    }).catch(() => {
      // Discovery can fail before there is a candidate to activate.
      if (navigator.onLine && state.status === 'idle' && !attempt && !registration?.waiting) {
        publish({ status: 'failed', detail: 'check_failed' });
      }
    });
  }

  function observeInstall() {
    const worker = registration?.installing;
    if (!worker) return;
    const changed = () => {
      if (worker.state === 'redundant') {
        if (!attempt && !registration?.waiting) publish({ status: 'failed', detail: 'activation_failed' });
      } else if (worker.state === 'installed') {
        void refreshCandidate();
      }
    };
    worker.addEventListener('statechange', changed);
    changed();
  }

  async function register() {
    if (!sw || registering || registration) return;
    registering = true;
    try {
      registration = await sw.register(base + 'sw.js', { scope: base, updateViaCache: 'none' });
      registration.addEventListener('updatefound', observeInstall);
      observeInstall();
      checkForUpdates();
    } catch {
      publish({ status: 'failed', detail: 'check_failed' });
    } finally {
      registering = false;
    }
  }

  function begin(id: string): Attempt {
    // Stop user input before the flush and keep it stopped until the decision is final.
    const app = document.getElementById('app');
    const wasInert = app?.inert ?? false;
    if (app) app.inert = true;
    attempt = { id, stop: new AbortController(), unlock: () => { if (app) app.inert = wasInert; } };
    publish({ status: 'saving' });
    return attempt;
  }

  function finish(current: Attempt) {
    if (attempt !== current) return;
    if (peer?.attempt === current) {
      clearTimeout(peer.timer);
      peer = undefined;
    }
    current.stop.abort();
    current.unlock();
    attempt = undefined;
  }

  async function flushLocal(signal: AbortSignal): Promise<boolean> {
    const save = flush;
    if (!save) return true; // No mounted editor registered pending work.
    const result = await bounded(Promise.resolve().then(save).catch(() => undefined), signal);
    return result?.ok === true && flush === save;
  }

  async function reloadInto(target: Release, current: Attempt) {
    const info = await inspectWorker(target.worker, current.stop.signal);
    if (attempt !== current) return;
    if (!info?.ready || info.buildId !== target.buildId || sw?.controller !== target.worker) {
      publish({ status: 'failed', detail: info ? 'activation_failed' : 'timeout' });
      return;
    }
    try {
      // Persist before reloading. Without a working guard, do not navigate automatically.
      if (sessionStorage.getItem(reloadKey) === target.buildId) throw new Error('Already requested');
      sessionStorage.setItem(reloadKey, target.buildId);
      publish({ status: 'reloading' });
      location.reload();
    } catch {
      publish({ status: 'failed', detail: 'reload_pending' });
    }
  }

  function send(message: PeerMessage) { channel?.postMessage(message); }

  async function activate(target: Release, current: Attempt) {
    if (!sw || registration?.waiting !== target.worker) {
      return publish({ status: 'failed', detail: 'activation_failed' });
    }
    const signal = current.stop.signal;
    const info = await inspectWorker(target.worker, signal);
    if (!info?.ready || info.buildId !== target.buildId) {
      return publish({ status: 'failed', detail: info ? 'activation_failed' : 'timeout' });
    }
    if (info.peers.length && (!channel || !await collectVotes(channel, {
      type: 'prepare', attempt: current.id, buildId: target.buildId, clients: info.peers,
    }, signal))) return publish({ status: 'paused', detail: 'other_client' });

    publish({ status: 'activating' });
    // Subscribe first: controllerchange may arrive before the message reply.
    const control = waitForControl(sw, target.worker, signal);
    const ack = await requestWorker(target.worker, {
      type: 'activate', buildId: target.buildId, readyClients: info.peers,
    }, signal);
    if (!ack) return publish({
      status: 'failed', detail: target.worker.state === 'redundant' ? 'activation_failed' : 'timeout',
    });
    if (ack.type !== 'activation' || ack.result === 'failed') {
      return publish({ status: 'failed', detail: 'activation_failed' });
    }
    if (ack.result === 'other_client') return publish({ status: 'paused', detail: 'other_client' });
    send({ type: 'commit', attempt: current.id });
    const acquired = await control;
    if (acquired !== 'controlled') {
      return publish({ status: 'failed', detail: acquired === 'redundant' ? 'activation_failed' : 'timeout' });
    }
    await reloadInto(target, current);
  }

  async function runLocal(target: Release, switchWorker: boolean) {
    if (attempt) return;
    const current = begin(crypto.randomUUID());
    try {
      if (!await flushLocal(current.stop.signal)) return publish({ status: 'paused', detail: 'save_failed' });
      if (switchWorker) await activate(target, current);
      else await reloadInto(target, current);
    } catch {
      publish({ status: 'failed', detail: 'activation_failed' });
    } finally {
      if (state.status !== 'reloading') {
        finish(current);
        if (switchWorker) send({ type: 'abort', attempt: current.id });
      }
    }
  }

  async function preparePeer(message: Extract<PeerMessage, { type: 'prepare' }>) {
    if (!clientId || !message.clients.includes(clientId)) return;
    const id = clientId;
    const vote = (ready: boolean) => send({ type: 'vote', attempt: message.attempt, clientId: id, ready });
    const worker = registration?.waiting;
    if (attempt || !worker || worker.state !== 'installed') return vote(false);
    const current = begin(message.attempt);
    const timer = setTimeout(() => {
      finish(current);
      publish({ status: 'failed', detail: 'timeout' });
    }, stepTimeout * 4);
    const prepared: Peer = { attempt: current, target: { worker, buildId: message.buildId }, ready: false, timer };
    peer = prepared;
    const info = await inspectWorker(worker, current.stop.signal);
    if (peer !== prepared) return;
    if (!info?.ready || info.buildId !== message.buildId || registration?.waiting !== worker) {
      finish(current);
      publish({ status: 'failed', detail: 'activation_failed' });
      return vote(false);
    }
    const ready = await flushLocal(current.stop.signal);
    if (peer !== prepared) return;
    prepared.ready = ready;
    if (!ready) {
      finish(current);
      publish({ status: 'paused', detail: 'save_failed' });
    }
    vote(ready);
  }

  async function commitPeer(prepared: Peer) {
    if (!sw || !prepared.ready) return;
    prepared.ready = false; // Only consume the commit once.
    const { attempt: current, target } = prepared;
    publish({ status: 'activating' });
    const acquired = await waitForControl(sw, target.worker, current.stop.signal);
    if (peer !== prepared) return;
    if (acquired === 'controlled') await reloadInto(target, current);
    else publish({ status: 'failed', detail: acquired === 'redundant' ? 'activation_failed' : 'timeout' });
    if (state.status === 'reloading') clearTimeout(prepared.timer);
    else finish(current);
  }

  const controller: UpdateController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async accept() {
      if (state.status === 'available' && candidate && registration?.waiting === candidate.worker) {
        await runLocal(candidate, true);
      }
    },
    async retry() {
      if (!sw || attempt) return;
      if (!registration) return register();
      await refreshCandidate(true);
      if (candidate && state.status === 'available') return runLocal(candidate, true);
      const worker = sw.controller;
      const info = worker ? await inspectWorker(worker) : undefined;
      if (worker && info?.ready && info.buildId !== __BUILD_ID__ && sw.controller === worker) {
        return runLocal({ worker, buildId: info.buildId }, false);
      }
      checkForUpdates();
    },
    setFlush(save) {
      flush = save;
      return () => { if (flush === save) flush = undefined; };
    },
    isOfflineReady: () => offlineReady && !!sw?.controller,
    checkOfflineReadiness: refreshOffline,
    onOfflineReadyChange(listener) {
      offlineListeners.add(listener);
      return () => { offlineListeners.delete(listener); };
    },
  };
  singleton = controller;
  if (typeof window !== 'undefined') {
    window.__pwaUpdate = {
      buildId: __BUILD_ID__, getState: controller.getState, isOfflineReady: controller.isOfflineReady,
      accept: controller.accept, retry: controller.retry,
    };
  }
  if (sw) {
    try { channel = new BroadcastChannel('pwa-web-os:update:' + base); } catch { /* Defer if another tab exists. */ }
    channel?.addEventListener('message', ({ data }: MessageEvent<PeerMessage>) => {
      if (data?.type === 'prepare') void preparePeer(data);
      else if (peer && data?.attempt === peer.attempt.id) {
        if (data.type === 'commit') void commitPeer(peer);
        if (data.type === 'abort' && state.status !== 'reloading') {
          finish(peer.attempt);
          publish({ status: 'paused', detail: 'other_client' });
        }
      }
    });
    sw.addEventListener('controllerchange', () => {
      setOffline(false);
      void refreshOffline();
      void refreshCandidate();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    });
    void register();
  }
  return controller;
}
