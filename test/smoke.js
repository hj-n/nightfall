// End-to-end smoke test. Runs the real server in this process (so the test can
// set up situations directly through `game`), connects headless clients over
// WebSocket, and checks the core loop. Run with: npm test
process.env.PORT = '8099';
process.env.SEED = '4242';
process.env.START_TIME = '10';

import { WebSocket } from 'ws';
import { World } from '../shared/world.js';
import { DAY_LENGTH } from '../shared/config.js';

const { game } = await import('../server/index.js');
await new Promise((r) => setTimeout(r, 300));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++; };

function client(name) {
  const ws = new WebSocket(`ws://localhost:${process.env.PORT}`);
  const c = { ws, snap: null, events: [], tiles: [] };
  c.send = (m) => ws.send(JSON.stringify(m));
  c.action = (name, data = {}) => c.send({ t: 'action', name, data });
  c.me = () => c.snap?.entities.find((e) => e.id === c.id);
  c.server = () => game.entities.get(c.id);
  c.saw = (name) => c.events.some((e) => e.name === name);
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.t === 'welcome') { c.id = m.id; c.world = World.generate(m.w, m.h, m.seed); c.world.applyEdits(m.edits); }
    if (m.t === 'snap') c.snap = m;
    if (m.t === 'event') c.events.push(m);
    if (m.t === 'tile') { c.tiles.push(m); c.world?.edit(m.x, m.y, m.id); }
  });
  return new Promise((r) => ws.on('open', () => { c.send({ t: 'hello', name }); setTimeout(() => r(c), 150); }));
}
const place = (c, x, y, dir = { x: 1, y: 0 }) => c.send({ t: 'move', x, y, dir });

// --- joining and movement --------------------------------------------------
const a = await client('Alice');
const b = await client('Bob');
await sleep(150);
check(a.id && b.id && a.id !== b.id, 'both clients welcomed with distinct ids');
check(b.snap?.entities.filter((e) => e.type === 'player').length === 2, 'snapshot contains both players');
const start = a.me();
check(start && !a.world.isSolid(start.x, start.y), 'player spawns on a walkable tile');
check(!Object.keys(start).some((k) => k.startsWith('_')), 'private fields are not sent');
place(a, start.x + 1, start.y);
await sleep(150);
check(Math.abs(b.snap.entities.find((e) => e.id === a.id).x - (start.x + 1)) < 1e-9, 'Bob sees Alice move');

// --- harvesting ------------------------------------------------------------
const trees = [];
for (let y = 1; y < a.world.h - 1 && trees.length < 6; y++)
  for (let x = 1; x < a.world.w - 1 && trees.length < 6; x++)
    if (a.world.tile(x, y).name === 'tree' && !a.world.isSolid(x - 1, y)) trees.push({ x, y });
for (const t of trees) { place(a, t.x - 0.5, t.y + 0.5); a.action('interact', { x: t.x, y: t.y }); }
await sleep(200);
check(a.me().inventory.wood === 6, `harvested 6 wood (got ${a.me().inventory.wood})`);
check(b.tiles.length === 6 && b.world.tile(trees[0].x, trees[0].y).name === 'grass', 'tile edits reach other clients');
const carol = await client('Carol');
check(carol.world.tile(trees[0].x, trees[0].y).name === 'grass', 'late joiner sees earlier tile edits');

// --- campfire: craft, feed, burn out ------------------------------------------
const t0 = trees[0];
place(a, t0.x - 0.5, t0.y + 0.5);
a.action('craft', { recipe: 'campfire' });
await sleep(150);
const fire = [...game.entities.values()].find((e) => e.type === 'campfire');
check(fire && b.snap.entities.some((e) => e.type === 'campfire'), 'crafted campfire appears for everyone');
check(a.me().inventory.wood === 1, 'crafting consumed 5 wood');
const before = fire.fuel;
a.action('interact', { x: Math.floor(fire.x), y: Math.floor(fire.y) });
await sleep(150);
check(fire.fuel > before + 15 && !a.me().inventory.wood, `feeding wood adds fuel (${before.toFixed(1)} -> ${fire.fuel.toFixed(1)})`);
fire.fuel = 0.05;
await sleep(200);
check(!fire.repels && fire.light < 1 && a.saw('fireOut'), 'fire burns out: stops repelling, embers glow');
fire.fuel = 60;

// --- combat: parry, block, unguarded hits ------------------------------------
const alice = a.server();
alice.dir = { x: 1, y: 0 };
place(a, alice.x, alice.y, { x: 1, y: 0 });
const slime = game.spawn('slime', { x: alice.x + 0.6, y: alice.y });
a.action('guard', { on: true });
await sleep(50);
let hp = alice.hp;
game.damage(alice, 1, slime);
await sleep(50);
check(alice.hp === hp && slime.stunnedUntil > game.time && a.saw('parry'), 'parry in the window cancels the hit and stuns');
await sleep(350);
slime.x = alice.x + 0.6; slime.y = alice.y;
game.damage(alice, 1, slime);
check(alice.hp === hp - 1, 'holding guard after the parry window does not protect without a shield');
game.give(alice, 'shield');
hp = alice.hp;
game.damage(alice, 1, slime);
await sleep(50);
check(alice.hp === hp && a.saw('block'), 'shield blocks hits from the front');
slime.x = alice.x - 0.6;
game.damage(alice, 1, slime);
check(alice.hp === hp - 1, 'shield does not block hits from behind');
a.action('guard', { on: false });
game.despawn(slime.id);
alice.hp = alice.maxHp;

// --- monsters and fire ---------------------------------------------------
game.time = DAY_LENGTH * 0.72; // night
fire.x = alice.x; fire.y = alice.y; fire.fuel = 60;
const intruder = game.spawn('slime', { x: alice.x + 1, y: alice.y });
const outsider = game.spawn('slime', { x: alice.x + 7, y: alice.y });
await sleep(2000);
const r = fire.light * 0.8;
const dIn = Math.hypot(intruder.x - fire.x, intruder.y - fire.y), dOut = Math.hypot(outsider.x - fire.x, outsider.y - fire.y);
check(dIn > r - 0.6 || !game.entities.has(intruder.id), `slime caught in firelight flees it (${dIn.toFixed(1)} vs radius ${r.toFixed(1)})`);
check(dOut > r - 0.3, `slime chasing a player stops at the firelight edge (${dOut.toFixed(1)})`);
check(alice.hp === alice.maxHp, 'player inside burning firelight takes no damage');
await sleep(1500);
check([...game.entities.values()].filter((e) => e.type === 'slime').length > 2, 'slimes spawn at night');

// --- resume by name ------------------------------------------------------
game.give(alice, 'stone', 3);
const pos = { x: alice.x, y: alice.y };
a.ws.close();
await sleep(200);
const a2 = await client('Alice');
await sleep(100);
check(a2.me()?.inventory.stone === 3 && Math.abs(a2.me().x - pos.x) < 1e-6, 'reconnecting with the same name restores inventory and position');

// --- robustness ----------------------------------------------------------
a2.action('attack');
a2.action('does-not-exist');
a2.send({ t: 'move', x: 'garbage' });
await sleep(150);
check(a2.ws.readyState === 1, 'server survives bad and unknown messages');
b.ws.close();
await sleep(200);
check(a2.snap.entities.filter((e) => e.type === 'player').length === 2, 'disconnected player is removed');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
