// End-to-end smoke test. Runs the real server in this process (so the test can
// set up situations directly through `game`), connects headless clients over
// WebSocket, and checks the core loop. Run with: npm test
process.env.PORT = '8099';
process.env.SEED = '4242';
process.env.START_TIME = '10';

import { WebSocket } from 'ws';
import { World } from '../shared/world.js';
import { clock } from '../shared/time.js';
const DAY_LENGTH = clock.dayLength;

const { game } = await import('../server/index.js');
const { computeBudget } = await import('../modules/creatures/director.js');
await new Promise((r) => setTimeout(r, 300));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(25); } return false; };
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

// --- mining: hold left click; tools make it faster --------------------------
const alice = a.server();
const slotOf = (item) => alice.hotbar.indexOf(item);
check(alice.hotbar[0] === 'sword' && a.me().hotbar[0] === 'sword', 'new players start with a sword in the first hotbar slot');
const trees = [];
for (let y = 1; y < a.world.h - 1 && trees.length < 6; y++)
  for (let x = 1; x < a.world.w - 1 && trees.length < 6; x++)
    if (a.world.tile(x, y).name === 'tree' && !a.world.isSolid(x - 1, y)) trees.push({ x, y });
const mineTree = async (t, wood) => {
  place(a, t.x - 0.5, t.y + 0.5);
  await sleep(60);
  const started = Date.now();
  a.action('mine', { x: t.x, y: t.y });
  await waitFor(() => a.me()?.inventory.wood === wood);
  return Date.now() - started;
};
const handMs = await mineTree(trees[0], 1);
check(handMs > 1500, `mining a tree by hand takes about its hardness (${handMs} ms)`);
game.give(alice, 'axe');
await sleep(100);
a.action('select', { slot: slotOf('axe') });
await sleep(60);
check(alice.selected === slotOf('axe'), 'select picks a hotbar slot');
const axeMs = await mineTree(trees[1], 2);
check(axeMs < 800, `an axe mines trees much faster (${axeMs} ms)`);
for (let i = 2; i < trees.length; i++) await mineTree(trees[i], i + 1);
check(a.me().inventory.wood === 6, `mined 6 wood (got ${a.me().inventory.wood})`);
check(b.tiles.length === 6 && b.world.tile(trees[0].x, trees[0].y).name === 'grass', 'tile edits reach other clients');
const carol = await client('Carol');
check(carol.world.tile(trees[0].x, trees[0].y).name === 'grass', 'late joiner sees earlier tile edits');

let rock = null;
for (let y = 1; y < a.world.h - 1 && !rock; y++)
  for (let x = 1; x < a.world.w - 1 && !rock; x++)
    if (a.world.tile(x, y).name === 'stone' && !a.world.isSolid(x - 1, y)) rock = { x, y };
const home = { x: alice.x, y: alice.y };
place(a, rock.x - 0.5, rock.y + 0.5);
await sleep(60);
a.action('mine', rock);
await sleep(1000);
check(game.world.tile(rock.x, rock.y).name === 'stone' && alice.mining?.p > 0, 'an axe does not speed up mining stone');
a.action('mine', { stop: true });
await sleep(60);
check(!alice.mining, 'letting go stops mining');
place(a, home.x, home.y);

// --- campfire: craft, place, feed, burn out ------------------------------------
const t0 = trees[0];
place(a, t0.x - 0.5, t0.y + 0.5);
a.action('craft', { recipe: 'campfire' });
await sleep(150);
check(a.me().inventory.campfire === 1 && a.me().inventory.wood === 1, 'crafting turns 5 wood into a campfire item');
a.action('select', { slot: slotOf('campfire') });
a.action('use', { x: t0.x, y: t0.y });
await sleep(150);
const fire = [...game.entities.values()].find((e) => e.type === 'campfire');
check(fire && b.snap.entities.some((e) => e.type === 'campfire') && !a.me().inventory.campfire, 'a campfire placed with right click appears for everyone');
const before = fire.fuel;
a.action('interact', { x: Math.floor(fire.x), y: Math.floor(fire.y) });
await sleep(150);
check(fire.fuel > before + 15 && !a.me().inventory.wood, `feeding wood adds fuel (${before.toFixed(1)} -> ${fire.fuel.toFixed(1)})`);
fire.fuel = 0.05;
await sleep(200);
check(!fire.repels && fire.light < 1 && a.saw('fireOut'), 'fire burns out: stops repelling, embers glow');
fire.fuel = 60;

// --- placing blocks and jack-o-lanterns ----------------------------------------
const overlapsTile = (t) => [...game.entities.values()].some((e) => Math.abs(e.x - t.x - 0.5) < 0.85 && Math.abs(e.y - t.y - 0.5) < 0.85);
const freeTiles = [];
for (let dy = -2; dy <= 2; dy++) {
  for (let dx = -2; dx <= 2; dx++) {
    const t = { x: Math.floor(alice.x) + dx, y: Math.floor(alice.y) + dy };
    if (Math.hypot(t.x + 0.5 - alice.x, t.y + 0.5 - alice.y) < 2.4 && !game.world.isSolid(t.x, t.y) && !overlapsTile(t)) freeTiles.push(t);
  }
}
const [wallAt, lanternAt] = freeTiles;
game.give(alice, 'wood', 2);
await sleep(100);
a.action('select', { slot: slotOf('wood') });
a.action('use', wallAt);
await sleep(150);
check(game.world.tile(wallAt.x, wallAt.y).name === 'wood-wall' && b.world.tile(wallAt.x, wallAt.y).solid, 'right click with wood places a wall for everyone');
const woodLeft = alice.inventory.wood;
a.action('use', wallAt);
const blocker = game.spawn('slime', { x: alice.x, y: alice.y, speed: 0 });
a.action('use', { x: Math.floor(alice.x), y: Math.floor(alice.y) });
await sleep(150);
check(alice.inventory.wood === woodLeft, 'nothing is placed on a solid tile or where someone stands');
game.despawn(blocker.id);

game.give(alice, 'pumpkin');
game.give(alice, 'wood');
a.action('craft', { recipe: 'jack-o-lantern' });
await sleep(150);
a.action('select', { slot: slotOf('jack-o-lantern') });
a.action('use', lanternAt);
await sleep(150);
const lantern = [...game.entities.values()].find((e) => e.type === 'jack-o-lantern');
check(lantern?.light > 0 && lantern.repels, 'a jack-o-lantern placed with right click gives light and scares monsters');
const pack = [1, 2].map((i) => game.spawn('slime', { x: lantern.x + 2 + i * 0.7, y: lantern.y, speed: 0 }));
await sleep(100);
check(lantern.repels, 'two slimes are still scared of a jack-o-lantern');
pack.push(game.spawn('slime', { x: lantern.x + 4.1, y: lantern.y, speed: 0 }));
await sleep(100);
check(!lantern.repels, 'a pack of three is brave enough to ignore it');
for (const s of pack) game.despawn(s.id);
game.despawn(lantern.id);

// --- combat: parry, block, unguarded hits ------------------------------------
a.action('select', { slot: slotOf('sword') });
await sleep(60);
const target = game.spawn('slime', { x: alice.x + 0.8, y: alice.y, speed: 0 });
place(a, alice.x, alice.y, { x: 1, y: 0 });
await sleep(60);
a.action('attack');
await sleep(60);
check(target.hp === 1, `the sword deals 2 damage (slime at ${target.hp} of 3 hp)`);
game.despawn(target.id);
alice.hp = alice.maxHp;
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

// --- game director ---------------------------------------------------------
check(['build-up', 'peak', 'relax'].includes(game.director?.state), `director is active at night (${game.director?.state})`);
const plain = computeBudget(game).budget;
for (const p of game.players()) game.give(p, 'shield');
const geared = computeBudget(game).budget;
check(geared > plain * 1.2, `better gear raises the threat budget (${plain.toFixed(1)} -> ${geared.toFixed(1)})`);
const extra = game.spawn('campfire', { x: 5, y: 5 });
check(computeBudget(game).budget > geared, 'a bigger settlement raises the threat budget');
game.despawn(extra.id);
const nightOne = computeBudget(game, { ...game.timeOfDay(), day: 1 }).budget;
const nightThree = computeBudget(game, { ...game.timeOfDay(), day: 3 }).budget;
check(nightThree > nightOne * 1.4, 'later nights get harder');
game.director.hordes = [0.5];
game.time = DAY_LENGTH * (0.7 + 0.25 * 0.51); // just past midnight
await sleep(300);
const horde = a.events.find((e) => e.name === 'horde');
check(horde && horde.data.count >= 3 && game.director.state === 'peak', `midnight horde arrives (${horde?.data.count} from the ${horde?.data.from})`);

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
