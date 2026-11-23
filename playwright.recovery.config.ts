import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import type { RecoveryOptions } from './scripts/notes-update-fixture';

// This run serves the retained builds directly. It has no Vite preview or
// dependency on a locally built app.
export default defineConfig<RecoveryOptions>({
  testDir: './e2e',
  testMatch: 'update-notes.spec.ts',
  grep: /rehearses A to B to retained A/,
  workers: 1,
  projects: base.projects,
  use: { retainedArtifacts: true, locale: 'en-US' },
});
