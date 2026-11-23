// STUB owned by the PWA workstream: implement the real Service Worker update coordinator.
import type { FlushResult, UpdateController, UpdateState } from '../contracts';

export function createUpdateController(): UpdateController {
  const state: UpdateState = { status: 'idle' };
  return {
    getState: () => state,
    subscribe: () => () => {},
    async accept() {},
    async retry() {},
    setFlush(_flush: () => Promise<FlushResult>) {
      return () => {};
    },
    isOfflineReady: () => false,
    onOfflineReadyChange: () => () => {},
  };
}
