# Team 1: World

**Folder:** `modules/world/` · **You own:** terrain, biomes, villages, caves and dungeons, resources

## Mission

You decide what players find when they explore. Your world passes run on the server and on every client with the same seed, so the island comes out identical everywhere and only tile changes travel over the network. A good island gives people reasons to leave the campfire: a village on the far shore, a cave full of ore, berries at the edge of the forest.

## What already exists

- `shared.js` registers six tiles (`water`, `sand`, `grass`, `tree`, `stone`, `gravel`) and one world pass, `terrain` (order 0), which builds an island from two noise fields: elevation decides water, sand, grass, and stone; moisture decides forests.
- Trees and stone are `solid` (block movement) and `opaque` (block line of sight), and both are harvestable with E.
- Players spawn at the walkable tile nearest the island center.
- `server.js` and `client.js` are empty stubs.

## Goals, in priority order

1. **Building tiles and villages (by 0:45).** Register `wall` (solid, opaque, `structure: true`, harvest gives `stone`, becomes `floor`), `door-closed` (solid, opaque, `structure: true`), `door-open` (`structure: true`), and `floor` (walkable). Survival depends on these names, so register them first and commit early. Then add a `villages` pass (order 200) that places two to four villages on open grass away from the spawn point: small houses of about 5 by 4 tiles with walls, a floor, and a door gap, joined by gravel paths. Push each village onto `world.features` as `{ type: 'village', x, y, w, h }`.
2. **Caves and ore (by 1:35).** Carve tunnels into stone areas (a few steps of cellular automata with the `rng` argument work well), and scatter ore tiles worth mining inside them, for example `iron-ore` (harvest gives `iron`) and `crystal`. Register the ore items too. Record each cave in `world.features` as `{ type: 'cave', ... }`, and mark one large cave as `type: 'dungeon'` for the Creatures team's boss.
3. **Stretch.** A `berry-bush` tile (harvest gives `berry`, becomes `grass`) at forest edges; register the `berry` item with `food: 20`. Biomes from a temperature noise field (snow in the north, desert in the south). Trees that regrow: a `server.js` system that occasionally turns a harvested `grass` tile back into `tree` with `game.setTile()`, away from players.

## What other teams expect from you

- **Survival** places `wall`, `door-closed`, `door-open`, and `floor` by name. Do not rename them.
- **Creatures** reads `game.world.features` to place villagers and the dungeon boss.
- **Survival** turns `berry` into food.
- **Art** will draw your new tiles; tell them the names as soon as you register them. Until then, tiles show their `color`.

## Rules that matter most for you

- Use only the `rng` argument and `fbm`, `valueNoise`, and `hash2` from `shared/rng.js`. One `Math.random()` gives every player a different island.
- Register tiles unconditionally at the top level of `shared.js`.
- Keep the area around the island center walkable: players spawn there.
- Keep passes fast. Every client runs them on joining; aim for well under 200 ms.
- Changing `shared.js` restarts the server and regenerates the island from the same seed, with everyone's tile edits reapplied on top. That is how you see your changes. Type `f` + Enter in the dev terminal for a completely fresh world.

## Testing

Run `node server/dev.js SEED=1234` (a fixed seed) and open two tabs: both must show the same villages in the same places. Walk to a village and through its door.

## Starter prompt for your agent

> Read CLAUDE.md, DESIGN.md, and modules/world/BRIEF.md. We are the World team and work only in modules/world/. First, register the building tiles wall, door-closed, door-open, and floor exactly as the brief describes. Then add a deterministic `villages` world pass (order 200) that places two to four small villages on open grass away from the island center and records each in world.features.
