// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { observeConnection } from './connection';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('ignores a late successful response after the browser goes offline', async () => {
  let complete!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const listener = vi.fn();
  const stop = observeConnection(listener);
  try {
    online.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    complete(new Response(null, { headers: { 'content-type': 'application/manifest+json' } }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(listener.mock.calls.flat()).toEqual(['checking', 'offline']);
    expect(fetch).toHaveBeenCalledOnce();
  } finally { stop(); }
});

it('times out, rejects an HTML fallback, and recovers on its next visible check', async () => {
  const reachOrigin = vi.fn<typeof fetch>()
    .mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('Aborted')));
    }))
    .mockResolvedValueOnce(new Response(null, { headers: { 'content-type': 'text/html' } }))
    .mockResolvedValueOnce(new Response(null, { headers: { 'content-type': 'application/manifest+json; charset=utf-8' } }));
  vi.stubGlobal('fetch', reachOrigin);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const listener = vi.fn();
  const stop = observeConnection(listener);
  try {
    await vi.advanceTimersByTimeAsync(5_000);
    expect(listener).toHaveBeenLastCalledWith('unreachable');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(listener.mock.calls.flat()).toEqual(['checking', 'unreachable']);
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(65_000);
    expect(reachOrigin).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenLastCalledWith('online');
  } finally { stop(); }
});
