// End-to-end smoke test: starts a server, connects two headless clients, and
// checks join, movement sync, harvesting, crafting and night spawns.
// Run with: npm test
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { World } from '../shared/world.js';
import { loadModules } from '../shared/loader.js';
import { DAY_LENGTH } from '../shared/config.js';

const PORT = 8099;
const server = spawn('node', ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), SEED: '4242', START_TIME: String(DAY_LENGTH * 0.69) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((r) => server.stdout.on('data', (d) => d.toString().includes('local:') && r()));
await loadModules('shared', (p) => import(`../modules/${p}`)); // tiles only, for local world generation

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++; };

function client(name) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const c = { ws, msgs: [], snap: null, events: [], tiles: [] };
  c.send = (m) => ws.send(JSON.stringify(m));
  c.me = () => c.snap?.entities.find((e) => e.id === c.id);
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.t === 'welcome') { c.id = m.id; c.world = World.generate(m.w, m.h, m.seed); c.world.applyEdits(m.edits); }
    if (m.t === 'snap') c.snap = m;
    if (m.t === 'event') c.events.push(m);
    if (m.t === 'tile') { c.tiles.push(m); c.world?.edit(m.x, m.y, m.id); }
  });
  return new Promise((r) => ws.on('open', () => { c.send({ t: 'hello', name }); r(c); }));
}

try {
  const a = await client('Alice');
  const b = await client('Bob');
  await sleep(300);
  check(a.id && b.id && a.id !== b.id, 'both clients welcomed with distinct ids');
  check(b.snap?.entities.filter((e) => e.type === 'player').length === 2, 'snapshot contains both players');

  const start = a.me();
  check(start && !a.world.isSolid(start.x, start.y), 'player spawns on a walkable tile');
  check(!Object.keys(start).some((k) => k.startsWith('_')), 'private fields are not sent');

  a.send({ t: 'move', x: start.x + 1, y: start.y, dir: { x: 1, y: 0 } });
  await sleep(200);
  const seenByB = b.snap.entities.find((e) => e.id === a.id);
  check(Math.abs(seenByB.x - (start.x + 1)) < 1e-9, 'Bob sees Alice move');

  // Harvest 5 trees: stand next to each one and interact.
  const trees = [];
  for (let y = 1; y < a.world.h - 1 && trees.length < 5; y++)
    for (let x = 1; x < a.world.w - 1 && trees.length < 5; x++)
      if (a.world.tile(x, y).name === 'tree' && !a.world.isSolid(x - 1, y)) trees.push({ x, y });
  for (const t of trees) {
    a.send({ t: 'move', x: t.x - 0.5, y: t.y + 0.5, dir: { x: 1, y: 0 } });
    a.send({ t: 'action', name: 'interact', data: { x: t.x, y: t.y } });
  }
  await sleep(300);
  check(a.me().inventory.wood === 5, `harvested 5 wood (got ${a.me().inventory.wood})`);
  check(b.tiles.length === 5 && b.world.tile(trees[0].x, trees[0].y).name === 'grass', 'tile edits reach other clients');

  // Late joiner receives the edits in its welcome.
  const c = await client('Carol');
  await sleep(200);
  check(c.world.tile(trees[0].x, trees[0].y).name === 'grass', 'late joiner sees earlier tile edits');

  // Craft a campfire on the now-empty tile to the right.
  const t0 = trees[0];
  a.send({ t: 'move', x: t0.x - 0.5, y: t0.y + 0.5, dir: { x: 1, y: 0 } });
  a.send({ t: 'action', name: 'craft', data: { recipe: 'campfire' } });
  await sleep(200);
  check(b.snap.entities.some((e) => e.type === 'campfire'), 'crafted campfire appears for everyone');
  check(!a.me().inventory.wood, 'crafting consumed the wood');

  // Night falls ~2.4 s after start; slimes should start spawning.
  await sleep(6000);
  check(a.events.some((e) => e.name === 'dusk'), 'dusk event broadcast');
  const slimes = a.snap.entities.filter((e) => e.type === 'slime').length;
  check(slimes > 0, `slimes spawn at night (${slimes})`);

  // Attack whatever is near: just verify the action does not crash the server.
  a.send({ t: 'action', name: 'attack', data: {} });
  a.send({ t: 'action', name: 'does-not-exist', data: {} });
  a.send({ t: 'move', x: 'garbage' });
  await sleep(200);
  check(a.ws.readyState === 1, 'server survives bad and unknown messages');

  b.ws.close();
  await sleep(200);
  check(a.snap.entities.filter((e) => e.type === 'player').length === 2, 'disconnected player is removed');
  a.ws.close(); c.ws.close();
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
