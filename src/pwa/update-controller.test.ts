import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlushResult } from '../contracts';
import type { ActivationReply, PeerMessage, WorkerInspection, WorkerRequest } from './protocol';
import { stepTimeout } from './worker-client';

declare const __BUILD_ID__: string;
const nextBuild = 'candidate-build';

// Hand-written browser fakes exercise only controller decisions. Playwright covers
// real registration, CacheStorage, BroadcastChannel, activation and navigation.
class FakePort {
  peer?: FakePort;
  onmessage?: (event: { data: WorkerInspection | ActivationReply }) => void;
  postMessage(data: WorkerInspection | ActivationReply) { this.peer?.onmessage?.({ data }); }
  close() { this.onmessage = undefined; }
}

class FakeMessageChannel {
  port1 = new FakePort();
  port2 = new FakePort();
  constructor() { this.port1.peer = this.port2; this.port2.peer = this.port1; }
}

class FakeBroadcastChannel extends EventTarget {
  static current: FakeBroadcastChannel;
  sent: PeerMessage[] = [];
  onSend?: (message: PeerMessage) => void;
  constructor() { super(); FakeBroadcastChannel.current = this; }
  postMessage(message: PeerMessage) { this.sent.push(message); this.onSend?.(message); }
  receive(data: PeerMessage) { this.dispatchEvent(new MessageEvent('message', { data })); }
}

class FakeWorker extends EventTarget {
  ready = true;
  peers: string[] = [];
  activate = vi.fn<(port: FakePort) => void>();
  constructor(readonly buildId: string, public state: ServiceWorkerState) { super(); }
  become(state: ServiceWorkerState) { this.state = state; this.dispatchEvent(new Event('statechange')); }
  postMessage(request: WorkerRequest, [port]: FakePort[]) {
    if (request.type === 'inspect') {
      port.postMessage({ type: 'inspection', buildId: this.buildId, ready: this.ready, clientId: 'self', peers: this.peers });
    } else {
      this.activate(port);
    }
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  update = vi.fn(async () => {});
}

class FakeWorkers extends EventTarget {
  controller: FakeWorker | null = new FakeWorker(__BUILD_ID__, 'activated');
  registration = new FakeRegistration();
  register = vi.fn(async () => this.registration);
  takeControl(worker: FakeWorker) {
    this.registration.waiting = null;
    this.controller = worker;
    worker.become('activated');
    this.dispatchEvent(new Event('controllerchange'));
  }
}

async function start(options: { waiting?: boolean; cached?: boolean; supported?: boolean } = {}) {
  const sw = new FakeWorkers();
  const target = new FakeWorker(nextBuild, 'installed');
  if (options.waiting !== false) sw.registration.waiting = target;
  target.ready = options.cached !== false;
  target.activate.mockImplementation((port) => {
    sw.takeControl(target); // controllerchange can precede the acknowledgement.
    port.postMessage({ type: 'activation', result: 'accepted' });
  });
  const storage = new Map<string, string>();
  const app = { inert: false };
  const document = Object.assign(new EventTarget(), { getElementById: () => app, visibilityState: 'visible' });
  vi.stubGlobal('navigator', options.supported === false ? {} : { serviceWorker: sw });
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', document);
  vi.stubGlobal('MessageChannel', FakeMessageChannel);
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key), setItem: storage.set.bind(storage) });
  const reload = vi.fn();
  vi.stubGlobal('location', { reload });
  const { createUpdateController } = await import('./update-controller');
  const updates = createUpdateController();
  await vi.advanceTimersByTimeAsync(0);
  return { updates, sw, target, reload, app, document, createUpdateController, channel: FakeBroadcastChannel.current };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/PWA-Web-OS/');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('update decisions with fake browser adapters', () => {
  it('registers once, polls on startup and when visible, and reports verified offline readiness', async () => {
    const { sw, updates, document, createUpdateController } = await start({ waiting: false });
    expect(createUpdateController()).toBe(updates);
    expect(sw.register).toHaveBeenCalledOnce();
    expect(sw.register).toHaveBeenCalledWith('/PWA-Web-OS/sw.js', { scope: '/PWA-Web-OS/', updateViaCache: 'none' });
    expect(sw.registration.update).toHaveBeenCalledOnce();
    expect(updates.isOfflineReady()).toBe(true);
    const notify = vi.fn();
    updates.onOfflineReadyChange(notify);
    sw.controller = null;
    sw.dispatchEvent(new Event('controllerchange'));
    expect(updates.isOfflineReady()).toBe(false);
    expect(notify).toHaveBeenCalledExactlyOnceWith(false);
    document.visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.registration.update).toHaveBeenCalledOnce();
    document.visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.registration.update).toHaveBeenCalledTimes(2);
  });

  it('stays idle without service workers', async () => {
    const { sw, updates } = await start({ supported: false });
    await updates.accept();
    await updates.retry();
    expect(sw.register).not.toHaveBeenCalled();
    expect(updates.getState()).toEqual({ status: 'idle' });
    expect(updates.isOfflineReady()).toBe(false);
  });

  it('does not offer an installed candidate with an incomplete cache', async () => {
    const { updates, target, reload } = await start({ cached: false });
    expect(updates.isOfflineReady()).toBe(true); // The old controller remains ready.
    expect(updates.getState()).toEqual({ status: 'failed', detail: 'activation_failed' });
    await updates.accept();
    expect(target.activate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('flushes before activation, then reloads once after an acknowledgement and matching control', async () => {
    const { updates, target, reload, app } = await start();
    const states: string[] = [];
    const flush = vi.fn(async () => {
      expect(app.inert).toBe(true);
      expect(target.activate).not.toHaveBeenCalled();
      return { ok: true } as const;
    });
    updates.subscribe(({ status }) => states.push(status));
    updates.setFlush(flush);
    expect(updates.getState()).toEqual({ status: 'available' });
    await updates.accept();
    await updates.accept();
    await updates.retry();
    expect(flush).toHaveBeenCalledOnce();
    expect(target.activate).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(states).toEqual(['saving', 'activating', 'reloading']);
  });

  it('pauses without activation on failed flush and retries by flushing again', async () => {
    const { updates, target, reload, app } = await start();
    const flush = vi.fn<() => Promise<FlushResult>>(async () => ({ ok: true }))
      .mockResolvedValueOnce({ ok: false, reason: 'conflict' });
    updates.setFlush(flush);
    await updates.accept();
    expect(updates.getState()).toEqual({ status: 'paused', detail: 'save_failed' });
    expect(target.activate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(app.inert).toBe(false);
    await updates.retry();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(['not ready', 'silent'])('pauses without activation when another client is %s', async (behavior) => {
    const { updates, target, channel, reload } = await start();
    target.peers = ['peer'];
    if (behavior === 'not ready') {
      channel.onSend = (message) => {
        if (message.type === 'prepare') channel.receive({
          type: 'vote', attempt: message.attempt, clientId: 'peer', ready: false,
        });
      };
    }
    const accept = updates.accept();
    await vi.advanceTimersByTimeAsync(stepTimeout + 1);
    await accept;
    expect(channel.sent.map(({ type }) => type)).toEqual(['prepare', 'abort']);
    expect(updates.getState()).toEqual({ status: 'paused', detail: 'other_client' });
    expect(target.activate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('votes not ready when a peer requests a flush and the local editor cannot save', async () => {
    const { updates, channel, reload, app } = await start();
    updates.setFlush(async () => ({ ok: false, reason: 'save_failed' }));
    channel.receive({ type: 'prepare', attempt: 'peer-attempt', clients: ['self'], buildId: nextBuild });
    await vi.advanceTimersByTimeAsync(0);
    expect(channel.sent).toEqual([{ type: 'vote', attempt: 'peer-attempt', clientId: 'self', ready: false }]);
    expect(updates.getState()).toEqual({ status: 'paused', detail: 'save_failed' });
    expect(app.inert).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('times out even after acknowledgement when the controller does not change', async () => {
    const { updates, target, reload, app } = await start();
    target.activate.mockImplementation((port) => port.postMessage({ type: 'activation', result: 'accepted' }));
    const accept = updates.accept();
    await vi.advanceTimersByTimeAsync(0);
    expect(updates.getState()).toEqual({ status: 'activating' });
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(stepTimeout + 1);
    await accept;
    expect(updates.getState()).toEqual({ status: 'failed', detail: 'timeout' });
    expect(app.inert).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads on controllerchange without an acknowledgement, but can retry a safe reload', async () => {
    const { updates, sw, target, reload } = await start();
    const flush = vi.fn(async () => ({ ok: true }) as const);
    updates.setFlush(flush);
    target.activate.mockImplementation(() => sw.takeControl(target));
    const accept = updates.accept();
    await vi.advanceTimersByTimeAsync(stepTimeout + 1);
    await accept;
    expect(updates.getState()).toEqual({ status: 'failed', detail: 'timeout' });
    expect(reload).not.toHaveBeenCalled();
    expect(updates.isOfflineReady()).toBe(false); // B controls a document still running A.
    await updates.retry();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reports a redundant installing worker as a failure', async () => {
    const { updates, sw, target, reload } = await start({ waiting: false });
    target.become('installing');
    sw.registration.installing = target;
    sw.registration.dispatchEvent(new Event('updatefound'));
    target.become('redundant');
    expect(updates.getState()).toEqual({ status: 'failed', detail: 'activation_failed' });
    expect(updates.isOfflineReady()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not loop if a new document still runs the old build with the same session flag', async () => {
    const { updates, reload } = await start();
    await updates.accept();
    expect(reload).toHaveBeenCalledOnce();
    vi.resetModules(); // Simulate a fresh JS document but keep the fake browser and its sessionStorage.
    const { createUpdateController } = await import('./update-controller');
    const oldDocument = createUpdateController();
    await vi.advanceTimersByTimeAsync(0);
    expect(oldDocument.getState()).toEqual({ status: 'failed', detail: 'reload_pending' });
    await oldDocument.retry();
    expect(oldDocument.getState()).toEqual({ status: 'failed', detail: 'reload_pending' });
    expect(reload).toHaveBeenCalledOnce();
  });
});
