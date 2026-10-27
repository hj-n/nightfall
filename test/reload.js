// Hot-restart test: runs `server/dev.js`, changes a server file and a client
// file, and checks that state survives and browsers are told to reload.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from '../shared/world.js';
import { loadModules } from '../shared/loader.js';

const PORT = 8097;
const STATE_FILE = path.join(os.tmpdir(), `nightfall-reload-test-${process.pid}.json`);
const dev = spawn('node', ['server/dev.js'], {
  env: { ...process.env, PORT: String(PORT), SEED: '777', STATE_FILE }, stdio: ['ignore', 'pipe', 'inherit'],
});
let log = '';
dev.stdout.on('data', (d) => { log += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(50); } return false; };
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++; };
await loadModules('shared', (p) => import(`../modules/${p}`));

function client(name) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const c = { ws, snap: null, closed: false, reloads: 0 };
  c.send = (m) => ws.send(JSON.stringify(m));
  c.me = () => c.snap?.entities.find((e) => e.id === c.id);
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.t === 'welcome') { c.id = m.id; c.world = World.generate(m.w, m.h, m.seed); c.world.applyEdits(m.edits); }
    if (m.t === 'snap') c.snap = m;
    if (m.t === 'reload') c.reloads++;
  });
  ws.on('close', () => { c.closed = true; });
  ws.on('error', () => {});
  return new Promise((r) => { ws.on('open', () => { c.send({ t: 'hello', name }); r(c); }); ws.on('error', () => r(null)); });
}
const touch = (rel) => { const f = path.resolve(rel); const t = new Date(); fs.utimesSync(f, t, t); };

try {
  await waitFor(() => log.includes('local:'));
  const a = await client('Dana');
  await waitFor(() => a.me());
  let tree = null;
  for (let y = 1; y < a.world.h && !tree; y++)
    for (let x = 1; x < a.world.w && !tree; x++)
      if (a.world.tile(x, y).name === 'tree' && !a.world.isSolid(x - 1, y)) tree = { x, y };
  a.send({ t: 'move', x: tree.x - 0.5, y: tree.y + 0.5, dir: { x: 1, y: 0 } });
  a.send({ t: 'action', name: 'interact', data: tree });
  await waitFor(() => a.me()?.inventory?.wood === 1);

  touch('modules/creatures/server.js');
  check(await waitFor(() => a.closed), 'server-side change restarts the server');
  check(await waitFor(() => log.split('Nightfall server').length === 3), 'server comes back up');

  let b = null;
  await waitFor(() => false, 300);
  for (let i = 0; i < 40 && !b; i++) { b = await client('Dana'); if (!b) await sleep(200); }
  await waitFor(() => b.me());
  check(b.me()?.inventory?.wood === 1, 'player inventory survives the restart');
  check(b.world.tile(tree.x, tree.y).name === 'grass', 'tile edits survive the restart');

  touch('modules/art/client.js');
  check(await waitFor(() => b.reloads > 0), 'client-only change tells browsers to reload');
  check(!b.closed, '...without restarting the server');
} finally {
  dev.kill();
  fs.rmSync(STATE_FILE, { force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
