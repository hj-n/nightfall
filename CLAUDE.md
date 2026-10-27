# Instructions for coding agents

You are helping one pair of people during a two-hour, ten-person game jam. Five pairs work in parallel on the same repo and commit straight to `main`. Read `DESIGN.md` for the game design, the full API, and the event list. The rules below keep five teams from breaking each other's work.

## Hard rules

1. **Work only in your team's folder:** `modules/world/`, `modules/player/`, `modules/survival/`, `modules/creatures/`, or `modules/art/`. Ask the user which team they are on if it is not obvious. Do not edit `shared/`, `server/`, `client/`, or another team's folder; if a change there is truly needed, stop and tell the user to ask the integration lead.
2. **Each team folder has exactly three entry files:** `shared.js` (loaded on server and client), `server.js`, and `client.js`. You may add helper files in the folder and import them from these three.
3. **Register tiles, items, recipes, entity types, spells, world passes, and key hints only in `shared.js`,** unconditionally, at the top level. Tile ids depend on registration order.
4. **The server decides gameplay.** Clients may only change their own player's `x`, `y`, and `dir`. Anything else (health, inventory, tiles, creatures) changes in `server.js` through `onAction` handlers and `registerSystem` systems.
5. **World passes must be deterministic.** Use the `rng` argument and `fbm` / `valueNoise` / `hash2` from `shared/rng.js`. Never `Math.random()` or `Date.now()` in a world pass.
6. **Entity defaults are plain JSON data.** No functions or class instances on entities. Fields starting with `_` are private to the side that sets them (AI state, cooldowns, animation timers).
7. **No new npm packages, no build tools, no TypeScript, no frameworks.** Plain JavaScript ES modules and Canvas 2D.
8. **Hurt things only with `game.damage(target, amount, source)`.** Never subtract `hp` directly: blocking and parrying hook into the `damage` event it emits.
9. **Coordinate with other teams through events and entity fields,** never by importing their files. Prefer adding a field (`e.burning = true`) or an event (`game.bus.emit('itemDropped', ...)`) that another team can pick up.
10. **Keep changes small** and make sure the game still starts after each one.

## Files

```
server/index.js        server: static files, WebSocket, game loop, server `game` object, persistence
server/dev.js          `npm run dev`: restarts the server on code changes, keeping state
client/main.js         client entry, client `game` object, frame loop
client/core/           input.js, net.js (snapshots, reconnect), render.js (tiles, entities,
                       lighting, fog, HUD), vision.js (fog of war, line of sight)
shared/registry.js     all register* functions        shared/world.js   World class
shared/rng.js          seeded random + noise          shared/time.js    day/night clock
shared/config.js       world size, tile size, tick rate, day length
modules/manifest.js    module load order
modules/<team>/        shared.js, server.js, client.js
```

Coordinates are in tiles (floats). Tile `(tx, ty)` covers `tx ≤ x < tx + 1`. Entity `x, y` is the entity's center. Use `game.world.blocked(x, y, r)` for collision and `game.world.tile(x, y)` to read a tile definition.

Entity fields with meaning across teams:

| Field | Meaning |
|---|---|
| `light` | Radius in tiles. Lights the night and decides what players can see after dusk (fog of war). Players carry `light: 2.5` (their torch). |
| `repels` | With `light`, monsters stay out of 80% of the light radius. Burning campfires set it; embers do not. |
| `hp`, `maxHp` | Makes an entity damageable through `game.damage()`. Non-players despawn at 0. |
| `stunnedUntil` | Game time until which a creature does nothing. Set by parries. |
| `guarding` | Player is holding guard (block with a shield, parry without). |
| `windup` | Creature is about to attack: the visual cue players parry on. |
| `inventory` | `{ itemName: count }`; change it only with `game.give()`. |

Tile flags: `solid` blocks movement, `opaque` blocks line of sight, `harvest: { item, count, becomes }` makes a tile harvestable with E.

## Patterns

**A new harvestable tile** (`shared.js`):

```js
import { registerTile, registerItem } from '../../shared/registry.js';
registerItem('iron', { color: '#b0a090' });
registerTile('iron-ore', { color: '#6d5f55', solid: true, harvest: { item: 'iron', becomes: 'gravel' } });
```

**A new creature** (type in `shared.js`, behavior in `server.js`, look in `modules/art/client.js` or your own `client.js`):

```js
// shared.js
registerEntityType('bat', { hp: 1, speed: 3, color: '#535' });

// server.js
import { registerSystem } from '../../shared/registry.js';
registerSystem('bat-ai', (game, dt) => {
  for (const e of game.entities.values()) {
    if (e.type !== 'bat') continue;
    e._t = (e._t || 0) + dt;
    e.x += Math.cos(e._t * 3) * e.speed * dt;
  }
});

// client.js
import { registerDrawer } from '../../shared/registry.js';
registerDrawer('bat', (ctx, e, sx, sy, T) => {
  ctx.fillStyle = e.color;
  ctx.fillRect(sx - T * 0.2, sy - T * 0.1, T * 0.4, T * 0.2);
});
```

**Damage and reactions** (`server.js`):

```js
game.damage(target, 2, attacker);                // the only way to hurt things
onEvent('damage', (game, hit) => {               // armor: halve damage for anyone wearing it
  if (game.has(hit.target, 'armor')) hit.amount = Math.ceil(hit.amount / 2);
});
onEvent('killed', (game, victim, killer) => {    // loot
  if (victim.type === 'slime') game.spawn('drop', { x: victim.x, y: victim.y, item: 'goo' });
});
```

**A new player action** (key in `client.js`, effect in `server.js`):

```js
// client.js
registerClientSystem('cast-input', (game) => {
  if (game.input.pressed('KeyF')) game.sendAction('cast', { spell: 'firebolt' });
});

// server.js
onAction('cast', (game, player, { spell }) => {
  game.spawn('firebolt', { x: player.x, y: player.y, vx: player.dir.x * 8, vy: player.dir.y * 8, owner: player.id, light: 2 });
});
```

**Feedback on every client** (server → client):

```js
game.broadcast('exploded', { x, y });                       // server.js
onEvent('net:exploded', (game, { x, y }) => { /* ... */ }); // client.js
```

An entity with a numeric `light` field lights up the night automatically. On the client, `game.canSee(x, y)` tells you whether the player can see a position right now (fog of war), and `game.targetTile()` gives the tile the player is aiming at with the mouse.

## Testing

- `npm run dev`, then open `http://localhost:8080/?name=A` and `http://localhost:8080/?name=B` in two tabs. Every saved change restarts the server (or just reloads the browsers for client-only files) and keeps the game state, so there is no need to restart anything by hand.
- `START_TIME=160 npm run dev` starts at dusk, so you can test night features right away. `SEED=1234` fixes the island.
- `npm test` runs headless tests of the core loop, combat, fire, and hot restart. Run it before pushing anything that touches harvesting, crafting, combat, or spawning.
- `window.game` in the browser console exposes the client state.
- Errors inside systems, handlers, and drawers are caught and logged (at most once every five seconds per site), so check the server terminal and the browser console after each change.
