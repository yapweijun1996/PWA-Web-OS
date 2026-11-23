import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import type { RecoveryOptions } from './scripts/notes-update-fixture';

const httpsRecovery = process.env.RECOVERY_HTTPS === '1';

// This run serves the retained builds directly. It has no Vite preview or
// dependency on a locally built app.
export default defineConfig<RecoveryOptions>({
  testDir: './e2e',
  testMatch: 'update-notes.spec.ts',
  grep: /rehearses A to B to retained A/,
  workers: 1,
  timeout: httpsRecovery ? 180_000 : 30_000,
  projects: base.projects,
  use: { retainedArtifacts: true, httpsRecovery, locale: 'en-US' },
});
