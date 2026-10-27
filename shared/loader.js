// Loads team modules in a fixed order on both server and client.
// All shared.js files load first (so tile ids match everywhere), then the
// side-specific files. A module that fails to load is skipped, not fatal.
// Owned by: Integration.
import { MODULES } from '../modules/manifest.js';
import { _setCurrentModule } from './registry.js';

export async function loadModules(side /* 'server' | 'client' */, importFn) {
  const failed = [];
  for (const part of ['shared', side]) {
    for (const name of MODULES) {
      _setCurrentModule(name);
      try {
        await importFn(`${name}/${part}.js`);
      } catch (err) {
        failed.push(`${name}/${part}.js`);
        console.error(`[loader] modules/${name}/${part}.js failed to load:`, err);
      }
    }
  }
  _setCurrentModule('core');
  return failed;
}
