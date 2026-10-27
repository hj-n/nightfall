# Nightfall: Design Document

CA3 Retreat 2026 · vibe-coding jam · 2 hours · up to 10 people in 5 pairs

## Pitch

Nightfall is a multiplayer top-down survival game on a small procedural island. By day, players explore, cut trees, mine stone, and build. At night, the island goes dark and slimes crawl out of the shadows; the only safe ground lies within the light of a campfire. The game borrows ideas from Minicraft (a top-down tile world you can mine and rebuild), Don't Starve (darkness as the enemy), and classic top-down action adventures (melee, villages, dungeons). Everything we make stays original: no borrowed names, sprites, or music.

## Design pillars

1. **The night is the clock.** A full day lasts four minutes, and the last quarter of it is night. All players face the same night at the same moment, which gives ten people a shared rhythm of preparation and panic.
2. **The world is the material.** Every tile can turn into something else. Trees become wood, stone becomes tunnels, and wood becomes walls.
3. **Small and playable beats big and broken.** Every feature should be playable within 20 minutes of starting work on it.

The core loop: explore, harvest, craft and build, survive the night, watch the slimes melt at dawn, and start again with better tools.

## What the skeleton already does

The repo runs out of the box and contains one thin vertical slice through every team's area:

- A seeded island with water, sand, grass, forests, and stone, generated identically on server and clients.
- WASD movement with wall sliding; other players move smoothly on your screen.
- **E** harvests the tile you face (tree gives wood, stone gives stone), and the change appears for everyone.
- **C** spends 5 wood on a campfire that lights the night.
- **Space** swings a melee attack. Slimes take three hits.
- At night, slimes spawn just off screen, chase the nearest player, and bite. Dead players respawn at the island center. Slimes melt at dawn.
- Code-drawn sprites, a darkness overlay with light sources, synthesized sound effects, and a HUD.

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
          │                             ▼  event, teleport
     ┌──────────────────────────────────────────────────┐
     │  CLIENT (browser) × 10                           │
     │  generates world from seed · moves own player    │
     │  client systems · drawers · HUDs                 │
     └──────────────────────────────────────────────────┘
```

The server owns everything except each player's own position. Clients simulate their own movement locally, so walking feels instant even on poor Wi-Fi, and report it with `move` messages. Everything else (inventories, health, creatures, tiles, time) changes only on the server; clients request changes through **actions**.

Five ideas hold the design together:

- **Deterministic world.** Server and clients run the same world passes with the same seed, so the network carries only tile edits, never the map. World passes must use the `rng` they receive and the noise helpers in `shared/rng.js`; a single `Math.random()` call desynchronizes everyone.
- **Registries.** Teams add content by calling `registerTile`, `registerItem`, `registerSystem`, and so on from their own folder. Nobody edits a central list, so merge conflicts nearly vanish.
- **Entities as plain objects (ECS-lite).** An entity is `{ id, type, x, y, ...components }`, for example `{ id: 7, type: 'slime', x: 81.5, y: 90.2, hp: 3, speed: 1.6 }`. Systems are functions that run every tick over the entities they care about. Fields that start with `_` stay private to the side that set them and never travel over the network.
- **Event bus.** Teams talk through events (`killed`, `dusk`, `net:hit`) and shared entity fields instead of importing each other's code.
- **Error isolation.** Every system, handler, drawer, and HUD runs inside a `try/catch`. A bug in one team's code logs an error at most every five seconds; the game keeps running.

## The contract

### Registry functions (`shared/registry.js`)

| Function | Call from | Purpose |
|---|---|---|
| `registerTile(name, { color, solid, harvest })` | `shared.js` | New tile type. `harvest: { item, count, becomes }` makes it harvestable with E. |
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
| `registerHud(name, fn(ctx, game, w, h))` | `client.js` | Draws in screen space. |

### The `game` object

On the **server**, systems and handlers receive `game` with `world`, `entities`, `time`, `bus`, and these helpers: `spawn(type, props)`, `despawn(id)`, `players()`, `near(x, y, r, filter)`, `setTile(x, y, name)`, `broadcast(name, data)`, `sendTo(playerId, name, data)`, `teleport(player, x, y)`, `give(entity, item, n)`, `has(entity, item, n)`, and `timeOfDay()`.

On the **client**, `game` has `world`, `entities`, `me`, `myId`, `input`, `camera`, and the helpers `sendAction(name, data)`, `facingTile()`, `screenToWorld(sx, sy)`, `worldToScreen(x, y)`, and `timeOfDay()`. Input uses key codes: `game.input.down('KeyW')` while held, `game.input.pressed('KeyE')` once per press, and `game.input.clicked(0)` for the left mouse button.

`timeOfDay()` returns `{ phase, darkness, isNight, day, clock }`.

### Events

| Event | Side | Arguments | Emitted by |
|---|---|---|---|
| `playerJoined`, `playerLeft` | server | player | core |
| `spawned`, `despawned` | server | entity | core |
| `dusk`, `dawn` | server | timeOfDay | core |
| `killed` | server | victim, killer | player |
| `net:dusk`, `net:dawn` | client | `{ day }` | core |
| `net:hit` | client | `{ id, x, y }` | player, creatures |
| `net:swing` | client | `{ id }` | player |
| `net:harvested` | client | `{ x, y, item, by }` | survival |
| `net:crafted` | client | `{ recipe, by }` | survival |
| `net:died` | client | `{}` (to the victim only) | player |
| `ready`, `disconnected` | client | none | core |
| `tileChanged` | client | x, y, id | core |
| `entityAppeared`, `entityGone` | client | entity | core |

Actions handled today: `attack` (player), `interact` and `craft` (survival). When you add an event or action, tell the integration lead so it lands in this table.

## Teams

| # | Team | Folder | Owns | Goal by integration 1 (0:45) | Goal by freeze (1:35) | Stretch |
|---|---|---|---|---|---|---|
| 1 | World | `modules/world` | Terrain, biomes, villages, dungeons, resources | Villages: small houses built from wall tiles, with paths between them | Cave or dungeon areas with ore tiles worth mining | New biomes (snow, desert), trees that regrow |
| 2 | Player | `modules/player` | Movement, combat, magic, health, death | Weapon feel: knockback, invulnerability frames, a health bar over damaged entities | Two or three spells with mana (a firebolt projectile entity, a heal) | Dodge roll, experience and levels |
| 3 | Survival | `modules/survival` | Items, equipment, crafting, building, hunger | Placeable walls and doors; slimes cannot pass walls | Hunger and food; campfires that burn out unless fed wood | Crafting menu, tools that harvest faster, chests, farming |
| 4 | Creatures | `modules/creatures` | Monsters, animals, NPCs, quests | A second monster type, and slimes that avoid campfire light | Villagers who hand out procedural quests ("bring 5 wood") | A blood-moon raid every third night; a dungeon boss |
| 5 | Integration and art | core files and `modules/art` | Server, netcode, merging, sprites, sound | Clean merge with everyone on the shared server | A sprite and sound for every new tile and entity | A music loop, particles, screen shake |

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
4. **Never call `Math.random()` in a world pass.** Use the `rng` argument.
5. **Keep entity defaults to plain data,** and prefix private fields with `_`.
6. **Add no npm packages and no build step.**
7. **Talk to other teams through events and entity fields,** not imports.

## Git workflow

Everyone clones the repo and commits directly to `main`. Pull requests would cost too much time, and folder ownership already prevents most conflicts.

- Commit small and often, roughly every 10 to 15 minutes, whenever something works.
- Run `git pull --rebase` before every `git push`.
- Each pair runs its own local server while developing: two browser tabs give you two players.
- The integration lead runs the **shared server** from their own checkout. The server sends its own copy of the game files to every browser, so all players automatically run the same version. At each checkpoint the lead pulls, restarts the server, and everyone reloads.
- If `main` breaks and the fix is not obvious within five minutes, `git revert` the commit and fix it locally.

## Running the game

```
npm install
npm start                      # http://localhost:8080/?name=You
START_TIME=160 npm start       # start just before dusk
SEED=1234 npm start            # the same island every time
PORT=9000 npm start
npm test                       # headless smoke test with three clients
```

The server prints its network address at startup. Eduroam often blocks connections between laptops, so test the shared server before the session. Fallbacks: a phone hotspot or travel router, or a small cloud or department VM.

## Schedule

| Time | Activity |
|---|---|
| 0:00 to 0:10 | Demo the skeleton on the projector. Pairs confirm their goal for integration 1. |
| 0:10 to 0:45 | Sprint 1: each team builds its first goal against the existing slice. |
| 0:45 to 0:55 | Integration 1: the lead merges and restarts; everyone plays for five minutes; each pair names one bug and one hook it needs from another team. |
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
