# Nightfall: Design Document

CA3 Retreat 2026 · vibe-coding jam · 2 hours · up to 10 people in 5 pairs

## Pitch

Nightfall is a multiplayer top-down survival game on a small procedural island. By day, players explore, cut trees, mine stone, and build. At night, the island goes dark and slimes crawl out of the shadows. Everyone carries a torch, but a torch only lets you see the monsters coming; the only safe ground lies within the light of a burning campfire, and campfires eat wood. The game borrows ideas from Minicraft (a top-down tile world you can mine and rebuild), Don't Starve (darkness as the enemy, fires you must keep fed), and classic top-down action adventures (melee, shields, villages, dungeons). Everything we make stays original: no borrowed names, sprites, or music.

## Design pillars

1. **The night is the clock.** A full day lasts four minutes, and the last quarter of it is night. All players face the same night at the same moment, which gives ten people a shared rhythm of preparation and panic.
2. **Light is the resource.** Torches let you see; fires keep you safe; wood keeps fires burning. Every night poses the same question: do we have enough wood?
3. **The world is the material.** Every tile can turn into something else. Trees become wood, stone becomes tunnels, and wood becomes walls.
4. **Small and playable beats big and broken.** Every feature should be playable within 20 minutes of starting work on it.

The core loop: explore, harvest, craft and build, survive the night around the fire, watch the slimes melt at dawn, and start again with better tools.

## Controls

| Input | Action |
|---|---|
| WASD or arrows | Move |
| Mouse | Aim (the player faces the cursor) |
| Left mouse or Space | Swing |
| Right mouse or Shift (hold) | Guard: block with a shield, otherwise parry |
| E | Harvest the targeted tile, or feed wood to a campfire |
| C | Build a campfire (5 wood) |
| V | Craft a shield (3 wood, 2 stone) |

The targeted tile is the one under the cursor when it is within reach, otherwise the tile in front of the player; a white outline marks it. Space and Shift mirror the mouse buttons for people on trackpads.

## What the skeleton already does

The repo runs out of the box and contains one thin vertical slice through every team's area:

- **World.** A seeded island with water, sand, grass, forests, and stone, generated identically on server and clients.
- **Fog of war.** Each player sees up to 13 tiles, and trees and stone block line of sight. Tiles you have seen before stay on screen, dimmed; tiles you have never seen stay black. After dusk you see only what some light source illuminates: your own torch, other players' torches, and campfires. Creatures outside your view are hidden.
- **Torch.** Every player carries a torch with a light radius of 2.5 tiles. It reveals monsters but does not keep them away.
- **Campfires.** A campfire starts with 45 seconds of fuel (maximum 90) and shows a fuel bar. Each wood fed with E adds 20 seconds. Its light shrinks during the last 30 seconds; at zero it turns to embers that no longer protect anyone.
- **Monsters and fire.** Slimes never step into the light of a burning campfire. They gather at its edge, and a slime caught inside when a new fire starts flees. A fire that burns out lets them in.
- **Combat.** Swing with the left mouse button (three hits kill a slime, with a little knockback). Slimes telegraph each bite: they swell and turn orange for 0.4 seconds. Holding guard with a shield blocks every hit from the front. Without a shield, guard parries: pressing it in the 0.25 seconds before a hit cancels the hit, knocks the attacker back, and stuns it for 1.2 seconds. Hits from the side or behind always land.
- **Death.** Dead players respawn at the island center with full health and keep their inventory.
- **Presentation.** Code-drawn sprites (torch, shield, swing arc, stun stars, flames, embers), sparks on parries and blocks, synthesized sound effects, and a HUD.
- **Hot restart.** `npm run dev` restarts the server on every code change in about a second and keeps the world, the creatures, and every player's position and inventory. Browsers reconnect and reload on their own.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Client | Plain JavaScript ES modules, Canvas 2D | No build step and no framework conventions to fight. LLM agents write Canvas code reliably. |
| Server | Node.js 18+ with one dependency (`ws`) | The same process serves the game files and the WebSocket. |
| Shared code | `shared/` and `modules/*/shared.js` | The same files run in Node and in the browser. |
| Art | Drawn in code | No asset pipeline, no licensing questions. |
| Sound | WebAudio synthesis (`blip()` in `modules/art/client.js`) | No audio files needed. |

## Architecture

```
                 SERVER (Node, authoritative, 20 Hz)
     ┌──────────────────────────────────────────────────┐
     │  world: seed + tile edits     clock: day/night   │
     │  entities: players, slimes, campfires, ...       │
     │  systems (every tick)   action handlers          │
     └──────────────────────────────────────────────────┘
          ▲  hello, move, action        │  welcome, snap, tile,
          │                             ▼  event, teleport, reload
     ┌──────────────────────────────────────────────────┐
     │  CLIENT (browser) × 10                           │
     │  generates world from seed · moves own player    │
     │  fog of war · client systems · drawers · HUDs    │
     └──────────────────────────────────────────────────┘
```

The server owns everything except each player's own position. Clients simulate their own movement locally, so walking feels instant even on poor Wi-Fi, and report it with `move` messages. Everything else (inventories, health, creatures, tiles, fuel, time) changes only on the server; clients request changes through **actions**.

Six ideas hold the design together:

- **Deterministic world.** Server and clients run the same world passes with the same seed, so the network carries only tile edits, never the map. World passes must use the `rng` they receive and the noise helpers in `shared/rng.js`; a single `Math.random()` call desynchronizes everyone.
- **Registries.** Teams add content by calling `registerTile`, `registerItem`, `registerSystem`, and so on from their own folder. Nobody edits a central list, so merge conflicts nearly vanish.
- **Entities as plain objects (ECS-lite).** An entity is `{ id, type, x, y, ...components }`, for example `{ id: 7, type: 'slime', x: 81.5, y: 90.2, hp: 3, speed: 1.6 }`. Systems are functions that run every tick over the entities they care about. Fields that start with `_` stay private to the side that set them and never travel over the network.
- **Shared fields as interfaces.** A few entity fields carry meaning across teams. `light` (radius in tiles) lights the night and defines what players can see. `repels: true` keeps monsters out of 80% of that radius. `stunnedUntil` freezes a creature. `hp` makes an entity damageable.
- **One damage pipeline.** All damage goes through `game.damage(target, amount, source)`, which first emits a `damage` event. Listeners can lower `hit.amount` or set `hit.cancelled`, which is how blocking and parrying work, and how armor, buffs, or friendly-fire rules would work.
- **Error isolation.** Every system, handler, drawer, and HUD runs inside a `try/catch`. A bug in one team's code logs an error at most every five seconds; the game keeps running.

## The contract

### Registry functions (`shared/registry.js`)

| Function | Call from | Purpose |
|---|---|---|
| `registerTile(name, { color, solid, opaque, harvest })` | `shared.js` | New tile type. `solid` blocks movement, `opaque` blocks sight, `harvest: { item, count, becomes }` makes it harvestable with E. |
| `registerItem(name, def)` | `shared.js` | New item type. |
| `registerRecipe(name, { inputs, output, places })` | `shared.js` | Crafting recipe. `places` spawns an entity in front of the player. |
| `registerEntityType(type, defaults)` | `shared.js` | New entity type. Defaults must be plain data. |
| `registerSpell(name, def)` | `shared.js` | New spell definition. |
| `registerWorldPass(name, fn(world, rng), { order })` | `shared.js` | World generation step. Terrain runs at order 0. |
| `registerKeyHint(key, label)` | `shared.js` | Adds a hint to the help line. |
| `registerSystem(name, fn(game, dt))` | `server.js` | Runs every server tick. |
| `onAction(name, fn(game, player, data))` | `server.js` | Handles `game.sendAction(name, data)` from a client. |
| `onEvent(name, fn(game, ...args))` | `server.js`, `client.js` | Listens on that side's event bus. |
| `registerClientSystem(name, fn(game, dt))` | `client.js` | Runs every frame in the browser. |
| `registerDrawer(type or 'tile:name', fn)` | `client.js` | Draws an entity type or tile type. |
| `registerHud(name, fn(ctx, game, w, h))` | `client.js` | Draws in screen space, after the world and the fog. |

### The `game` object

On the **server**, systems and handlers receive `game` with `world`, `entities`, `time`, `bus`, and these helpers: `spawn(type, props)`, `despawn(id)`, `players()`, `near(x, y, r, filter)`, `damage(target, amount, source)`, `knockback(entity, fromX, fromY, dist)`, `setTile(x, y, name)`, `broadcast(name, data)`, `sendTo(playerId, name, data)`, `teleport(player, x, y)`, `give(entity, item, n)`, `has(entity, item, n)`, and `timeOfDay()`.

On the **client**, `game` has `world`, `entities`, `me`, `myId`, `input`, `camera`, `vision`, and the helpers `sendAction(name, data)`, `targetTile()`, `facingTile()`, `canSee(x, y)`, `screenToWorld(sx, sy)`, `worldToScreen(x, y)`, and `timeOfDay()`. Input uses key codes: `game.input.down('KeyW')` while held, `game.input.pressed('KeyE')` once per press, `game.input.clicked(0)` once per left click, and `game.input.mouseDown(2)` while the right button is held.

`timeOfDay()` returns `{ phase, darkness, isNight, day, clock }`.

### Events

| Event | Side | Arguments | Emitted by |
|---|---|---|---|
| `playerJoined`, `playerLeft` | server | player | core |
| `spawned`, `despawned` | server | entity | core |
| `dusk`, `dawn` | server | timeOfDay | core |
| `damage` | server | hit `{ target, amount, source, cancelled }` | core, before damage applies |
| `killed` | server | victim, killer | core |
| `net:dusk`, `net:dawn` | client | `{ day }` | core |
| `net:hit` | client | `{ id, x, y, amount }` | core |
| `net:swing` | client | `{ id }` | player |
| `net:parry`, `net:block` | client | `{ id, x, y }` (parry also `target`) | player |
| `net:died` | client | `{}` (to the victim only) | player |
| `net:harvested` | client | `{ x, y, item, by }` | survival |
| `net:crafted` | client | `{ recipe, by }` | survival |
| `net:fed`, `net:fireOut` | client | `{ id, ... }` | survival |
| `ready`, `disconnected` | client | none | core |
| `tileChanged` | client | x, y, id | core |
| `entityAppeared`, `entityGone` | client | entity | core |

Actions handled today: `attack` and `guard` (player), `interact` and `craft` (survival). When you add an event or action, tell the integration lead so it lands in this table.

## Teams

| # | Team | Folder | Owns | Goal by integration 1 (0:45) | Goal by freeze (1:35) | Stretch |
|---|---|---|---|---|---|---|
| 1 | World | `modules/world` | Terrain, biomes, villages, dungeons, resources | Villages: small houses built from wall tiles, with paths between them | Caves or dungeons with ore tiles worth mining | New biomes (snow, desert), trees that regrow, flowers or berries to forage |
| 2 | Player | `modules/player` | Movement, combat, magic, health, death | Weapon feel: a health bar over damaged entities, invulnerability frames, a dodge roll | Two or three spells with mana, such as a firebolt projectile that carries `light` | Weapon types, experience and levels |
| 3 | Survival | `modules/survival` | Items, equipment, crafting, building, hunger, fire | Placeable walls and doors; slimes cannot pass walls | Hunger and food; craftable torches that burn out; a stone fire pit that burns longer | Crafting menu, tools that harvest faster, chests, farming |
| 4 | Creatures | `modules/creatures` | Monsters, animals, NPCs, quests | A second monster that ignores fire, or one that snuffs out campfires | Villagers who hand out procedural quests ("bring 5 wood") | A blood-moon raid every third night; a dungeon boss |
| 5 | Integration and art | core files and `modules/art` | Server, netcode, merging, sprites, sound | Clean merge with everyone on the shared server | A sprite and sound for every new tile and entity | A music loop, particles, screen shake, a minimap of explored tiles |

If fewer than ten people take part, staff teams in this order: World, Player, and Integration first, then Survival and Creatures. Art folds into Integration.

### Signup

| Team | Person A | Person B |
|---|---|---|
| 1 World | | |
| 2 Player | | |
| 3 Survival | | |
| 4 Creatures | | |
| 5 Integration and art | | |

## Rules

1. **Edit only your own folder.** If you need a change in `shared/`, `server/`, or `client/`, ask the integration lead.
2. **Register content in `shared.js`.** Tiles, items, recipes, entity types, spells, and world passes go there, because both server and clients must load them in the same order.
3. **Decide gameplay on the server.** Clients send actions; they never change health, inventories, or tiles themselves.
4. **Hurt things only with `game.damage()`,** so blocking, parrying, and future armor keep working.
5. **Never call `Math.random()` in a world pass.** Use the `rng` argument.
6. **Keep entity defaults to plain data,** and prefix private fields with `_`.
7. **Add no npm packages and no build step.**
8. **Talk to other teams through events and entity fields,** not imports.

## Development workflow

Use `npm run dev` for all development, both locally and on the shared server. It watches the code and acts on every saved change:

- A change to client-only code (`client/`, any `modules/*/client.js`) makes every connected browser reload. The server keeps running.
- Any other change saves the game state, restarts the server, and the browsers reconnect and reload on their own. Players keep their position and inventory, matched by name; tiles, creatures, and campfires survive as well. Tile edits are stored by tile name, so adding new tiles is safe.
- If new code crashes the server on startup, the terminal says so and the supervisor waits for the next save. Browsers keep retrying in the meantime.

Reloading the page or losing Wi-Fi also keeps your player: the name in the URL (`?name=Ada`) is your identity, so pick a unique one.

## Git workflow

Everyone clones the repo and commits directly to `main`. Pull requests would cost too much time, and folder ownership already prevents most conflicts.

- Commit small and often, roughly every 10 to 15 minutes, whenever something works.
- Run `git pull --rebase` before every `git push`.
- Each pair runs its own local `npm run dev` while developing: two browser tabs give you two players.
- The integration lead runs the **shared server** with `npm run dev` from their own checkout. The server sends its own copy of the game files to every browser, so all players run the same version. Thanks to hot restart, a `git pull` on that checkout deploys itself; nobody needs to restart anything or reload by hand.
- If `main` breaks and the fix is not obvious within five minutes, `git revert` the commit and fix it locally.

## Running the game

```
npm install
npm run dev                    # http://localhost:8080/?name=You, hot restart on changes
npm start                      # plain server, fresh world each start
START_TIME=160 npm run dev     # start at dusk
SEED=1234 npm run dev          # the same island every time
PORT=9000 npm run dev
npm test                       # headless tests: core loop, combat, fire, hot restart
```

The server prints its network address at startup. Eduroam often blocks connections between laptops, so test the shared server before the session. Fallbacks: a phone hotspot or travel router, or a small cloud or department VM.

## Schedule

| Time | Activity |
|---|---|
| 0:00 to 0:10 | Demo the skeleton on the projector. Pairs confirm their goal for integration 1. |
| 0:10 to 0:45 | Sprint 1: each team builds its first goal against the existing slice. |
| 0:45 to 0:55 | Integration 1: the lead pulls; the server hot-restarts; everyone plays for five minutes; each pair names one bug and one hook it needs from another team. |
| 0:55 to 1:35 | Sprint 2: cross-team features (enemies drop items, villagers request crafted goods, spells light the dark). |
| 1:35 to 1:50 | Feature freeze: bug fixes and polish only. |
| 1:50 to 2:00 | Final session: everyone survives one night together on the projector. |

## Vibe-coding tips

- Start every agent session with: "Read CLAUDE.md and DESIGN.md, then work only in `modules/<your team>/`."
- Ask for one small, testable change at a time, and test it in two tabs before asking for the next.
- Commit each working state. Throw away failed attempts quickly with `git checkout .` rather than prompting the agent into deeper holes.
- If you stay stuck for more than ten minutes, swap drivers or ask the integration lead.

## Open questions

- Do we fix the seed so the demo island is known in advance?
- Do we want a goal, such as a score for nights survived or a boss to defeat on the last night?
- Should explored tiles be shared between players (a team map) or stay personal as now?
