import { createStorage } from './storage';
import { createPreferenceStore } from './prefs';
import { createUpdateController } from './pwa/update-controller';
import { mountApp } from './ui/mount';

declare const __BUILD_ID__: string;

const root = document.getElementById('app');
if (root) {
  mountApp(root, {
    storage: createStorage(),
    prefs: createPreferenceStore(),
    updates: createUpdateController(),
    buildId: __BUILD_ID__,
  });
}
