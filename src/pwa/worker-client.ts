import type { ActivationReply, PeerMessage, WorkerInspection, WorkerRequest } from './protocol';

declare const __BUILD_ID__: string;

export const stepTimeout = 8_000;

// Abort also removes the timer and lets transports detach their listeners.
export async function bounded<T>(work: Promise<T>, signal?: AbortSignal): Promise<T | undefined> {
  if (signal?.aborted) return undefined;
  let abort!: () => void;
  const deadline = new Promise<undefined>((resolve) => { abort = () => resolve(undefined); });
  const timer = setTimeout(abort, stepTimeout);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function requestWorker(worker: ServiceWorker, request: WorkerRequest, signal?: AbortSignal) {
  if (signal?.aborted) return;
  const channel = new MessageChannel();
  try {
    const reply = new Promise<WorkerInspection | ActivationReply>((resolve) => {
      channel.port1.onmessage = (event) => resolve(event.data);
    });
    worker.postMessage(request, [channel.port2]);
    return await bounded(reply, signal);
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
}

export async function inspectWorker(worker: ServiceWorker, signal?: AbortSignal, repairMissing = false): Promise<WorkerInspection | undefined> {
  const reply = await requestWorker(worker, { type: 'inspect', documentBuildId: __BUILD_ID__, repairMissing }, signal)
    .catch(() => undefined);
  return reply?.type === 'inspection' ? reply : undefined;
}

export async function waitForControl(sw: ServiceWorkerContainer, worker: ServiceWorker, signal: AbortSignal) {
  let check!: () => void;
  const changed = new Promise<'controlled' | 'redundant'>((resolve) => {
    check = () => {
      if (worker.state === 'redundant') resolve('redundant');
      else if (sw.controller === worker && worker.state === 'activated') resolve('controlled');
    };
  });
  sw.addEventListener('controllerchange', check);
  worker.addEventListener('statechange', check);
  check();
  try {
    return await bounded(changed, signal);
  } finally {
    sw.removeEventListener('controllerchange', check);
    worker.removeEventListener('statechange', check);
  }
}

export async function collectVotes(
  channel: BroadcastChannel,
  prepare: Extract<PeerMessage, { type: 'prepare' }>,
  signal: AbortSignal,
): Promise<boolean> {
  const pending = new Set(prepare.clients);
  let vote!: (event: MessageEvent<PeerMessage>) => void;
  const replies = new Promise<boolean>((resolve) => {
    vote = ({ data }) => {
      if (data?.type !== 'vote' || data.attempt !== prepare.attempt || !pending.delete(data.clientId)) return;
      if (data.ready !== true) resolve(false);
      else if (!pending.size) resolve(true);
    };
  });
  channel.addEventListener('message', vote);
  try {
    channel.postMessage(prepare);
    return (await bounded(replies, signal)) === true;
  } finally {
    channel.removeEventListener('message', vote);
  }
}
