// STUB owned by the UI workstream: replace with the real launcher, Notes list and editor.
import type { AppDeps } from '../contracts';

export function mountApp(root: HTMLElement, deps: AppDeps): void {
  root.innerHTML =
    '<main><h1>PWA Web OS</h1><p id="build-id"></p><p>Notes: not implemented yet</p></main>';
  const id = root.querySelector('#build-id');
  if (id) id.textContent = `Build ID: ${deps.buildId}`;
}
