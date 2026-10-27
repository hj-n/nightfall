// Dev supervisor: `npm run dev`. Owned by: Integration.
//
// Runs server/index.js as a child process and reacts to every saved change with
// the lightest update that is safe:
//
//   changed file                         what happens
//   modules/*/client.js, client/, html   browsers reload; server untouched
//   modules/*/server.js                  HOT SWAP: new server code runs in place;
//                                        nobody disconnects, nothing reloads
//   other files in modules/<team>/       hot swap + browsers reload (helpers may
//     (helpers)                          be used on either side)
//   modules/*/shared.js, shared/,        RESTART: state saved, server restarted,
//     server/, manifest.js               state restored; browsers reconnect and
//                                        reload; players keep their stuff
//
// shared.js changes need a restart because they define tiles and entity types:
// the "data model". When a change breaks saved state, start fresh with `f`.
//
// Type in this terminal:  h + Enter  hot swap now
//                         r + Enter  restart, keeping state
//                         f + Enter  restart with a FRESH world (state discarded)
import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCH_ROOTS = ['server', 'shared', 'client', 'modules'].map((d) => path.join(ROOT, d));
const SERVER = path.join(ROOT, 'server', 'index.js');
const STATE_FILE = process.env.STATE_FILE || path.join(ROOT, '.nightfall-state.json');

let child = null;
let startedAt = 0;
let restarting = false;
let restore = !!process.env.RESTORE; // first start is fresh unless RESTORE=1

function start() {
  startedAt = Date.now();
  child = fork(SERVER, [], { env: { ...process.env, RESTORE: restore ? '1' : '' } });
  restore = true;
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

async function restart({ fresh = false } = {}) {
  restarting = true;
  const c = child;
  if (c) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => { c.kill('SIGKILL'); resolve(); }, 2000); // stuck in a loop? kill it
      c.once('exit', () => { clearTimeout(timer); resolve(); });
      try { c.send('save-and-exit'); } catch { c.kill('SIGKILL'); }
    });
  }
  if (fresh) { fs.rmSync(STATE_FILE, { force: true }); restore = false; }
  restarting = false;
  start();
}

const tell = (msg) => { try { child?.send(msg); } catch {} };

function classify(f) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (rel.startsWith('client/') || /\.(html|css|png|svg|wav|mp3|ogg)$/.test(rel)) return 'client';
  if (!rel.startsWith('modules/') || rel === 'modules/manifest.js') return 'restart';
  const base = path.basename(rel);
  if (base === 'shared.js') return 'restart';
  if (base === 'client.js') return 'client';
  if (base === 'server.js') return 'server';
  return 'helper';
}

let pending = new Set();
let timer = null;
function changed(file) {
  if (!/\.(js|json|html|css|png|svg|wav|mp3|ogg)$/.test(file) || path.basename(file).startsWith('.')) return;
  pending.add(file);
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const files = [...pending];
    pending = new Set();
    const kinds = new Set(files.map(classify));
    const names = files.map((f) => path.relative(ROOT, f)).join(', ');
    if (!child || kinds.has('restart')) {
      console.log(`[dev] ${names} changed: restarting server, keeping state`);
      await restart();
    } else {
      const swap = kinds.has('server') || kinds.has('helper');
      const reload = kinds.has('client') || kinds.has('helper');
      console.log(`[dev] ${names} changed: ${[swap && 'hot-swapping server code', reload && 'reloading browsers'].filter(Boolean).join(' + ')}`);
      if (swap) tell('hot-swap');
      if (reload) tell('reload-clients');
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

if (process.stdin.isTTY) {
  readline.createInterface({ input: process.stdin }).on('line', async (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === 'h') { console.log('[dev] hot swap'); tell('hot-swap'); }
    else if (cmd === 'r') { console.log('[dev] restart, keeping state'); await restart(); }
    else if (cmd === 'f') { console.log('[dev] restart with a fresh world'); await restart({ fresh: true }); }
    else if (cmd) console.log('[dev] commands: h = hot swap, r = restart keeping state, f = fresh world');
  });
}

watchAll();
start();
console.log('[dev] watching for changes. Type h (hot swap), r (restart), or f (fresh world) + Enter.');
