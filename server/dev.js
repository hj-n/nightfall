// Dev supervisor: `npm run dev`. Owned by: Integration.
//
// Runs server/index.js as a child process and watches the code:
//   - a change to client-only code (client/, any modules/*/client.js, .html, .css)
//     tells every browser to reload; the server keeps running.
//   - any other change saves the game state, restarts the server, and every
//     browser reconnects and reloads by itself. Players keep their position and
//     inventory (matched by name); tiles, creatures and campfires survive too.
// A `git pull` on the shared server therefore deploys itself in about a second.
import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCH_ROOTS = ['server', 'shared', 'client', 'modules'].map((d) => path.join(ROOT, d));
const SERVER = path.join(ROOT, 'server', 'index.js');

let child = null;
let startedAt = 0;
let restarting = false;
let firstStart = true;

function start() {
  startedAt = Date.now();
  child = fork(SERVER, [], { env: { ...process.env, RESTORE: firstStart && !process.env.RESTORE ? '' : '1' } });
  firstStart = false;
  child.on('exit', (code) => {
    child = null;
    if (restarting) return;
    if (Date.now() - startedAt < 3000) {
      console.log(`\n[dev] server crashed on startup (code ${code}). Fix the error and save any file to retry.\n`);
    } else {
      console.log(`\n[dev] server crashed (code ${code}); restarting from the last autosave in 1 s`);
      setTimeout(() => { if (!child) start(); }, 1000);
    }
  });
}

async function restart() {
  restarting = true;
  const c = child;
  if (c) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => { c.kill('SIGKILL'); resolve(); }, 2000); // stuck in a loop? kill it
      c.once('exit', () => { clearTimeout(timer); resolve(); });
      try { c.send('save-and-exit'); } catch { c.kill('SIGKILL'); }
    });
  }
  restarting = false;
  start();
}

const isClientOnly = (f) =>
  f.startsWith(path.join(ROOT, 'client') + path.sep) || path.basename(f) === 'client.js' || /\.(html|css|png|svg|wav|mp3|ogg)$/.test(f);

let pending = new Set();
let timer = null;
function changed(file) {
  if (!/\.(js|json|html|css|png|svg|wav|mp3|ogg)$/.test(file)) return; // ignore editor temp files
  pending.add(file);
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const files = [...pending];
    pending = new Set();
    const names = files.map((f) => path.relative(ROOT, f)).join(', ');
    if (child && files.every(isClientOnly)) {
      console.log(`[dev] ${names} changed: reloading browsers`);
      try { child.send('reload-clients'); } catch {}
    } else {
      console.log(`[dev] ${names} changed: restarting server, keeping state`);
      await restart();
    }
    watchAll(); // pick up new folders
  }, 300);
}

// fs.watch with { recursive: true } is missing on Linux before Node 20, so
// watch every directory individually.
const watched = new Map();
function watchAll() {
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    if (!watched.has(dir)) {
      try {
        const w = fs.watch(dir, (ev, name) => name && changed(path.join(dir, name.toString())));
        w.on('error', () => { w.close(); watched.delete(dir); }); // folder deleted
        watched.set(dir, w);
      } catch {}
    }
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) if (d.isDirectory()) walk(path.join(dir, d.name));
  };
  WATCH_ROOTS.forEach(walk);
}

watchAll();
start();
console.log('[dev] watching server/, shared/, client/, modules/ for changes');
