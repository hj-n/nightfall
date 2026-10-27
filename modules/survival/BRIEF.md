# Team 3: Survival

**Folder:** `modules/survival/` · **You own:** items, equipment, crafting, building, hunger, fire

## Mission

You decide what players make and what they need. The central tension of the game is yours: light keeps you safe, fire eats wood, and wood lies out in the dark. Building turns a campfire into a camp, and hunger keeps people from turtling in that camp forever.

## What already exists

- `shared.js`: items `wood`, `stone`, and `shield` (`equip: 'offhand'`); recipes `campfire` (5 wood, places a campfire) and `shield` (3 wood, 2 stone); the `campfire` entity type (`fuel: 45`, `maxFuel: 90`, `light: 6`, `repels: true`).
- `server.js`: the `interact` action (E): feed wood to a campfire at the target tile (+20 s of fuel), or harvest a tile with a `harvest` field; the `craft` action; and the `fire` system, which burns fuel, shrinks the light in the last 30 seconds, and turns the fire to embers at zero.
- `client.js`: keys E, C, and V; the outline around the targeted tile; the inventory and health HUD.
- Inventories are `{ itemName: count }` on the entity. Change them only with `game.give(entity, item, n)` and check them with `game.has(entity, item, n)`.

## Goals, in priority order

1. **Walls and doors (by 0:45).** World registers the tiles `wall`, `door-closed`, `door-open`, and `floor`; you place them. Add **B** to build a wall at the targeted tile (cost: 1 stone or 2 wood) and **N** to build a closed door. Placing must fail on solid tiles and on tiles where an entity stands (`game.near()`). Extend the recipe format with `placesTile: 'wall'` and handle it in your `craft` handler with `game.setTile()`. Let E open and close doors, and make E on a wall take it back down. Slimes respect walls automatically because they use `world.blocked()`, and every wall counts toward the director's settlement score.
2. **Hunger and fire upgrades (by 1:35).**
   - Add `hunger` (start 100) to the player defaults and a system that lowers it slowly (empty after about one full day). At zero, hurt the player with `game.damage(player, 1, null)` every few seconds. Show a hunger bar.
   - **R** eats the best food item in the inventory. An item's `food` field says how much hunger it restores: `berry` comes from World and `meat` from Creatures. Cooking: E with `meat` at a burning campfire turns it into `cooked-meat`, which restores more.
   - A `stone fire pit` recipe that places a fire with a higher `maxFuel`. Generalize the `fire` system to every entity with a `fuel` field, so new fire types work without copying code.
   - Craftable lanterns: an equipped `lantern` raises the player's `light` from 2.5 to 4.
3. **Stretch.** A crafting menu on **Tab** (a HUD that lists recipes with their costs; number keys craft); tools such as an axe that yields 2 wood per tree (with a `gear` value); chests (an entity with its own inventory); farming.

## What other teams expect from you

- **World** registers the building tiles and `berry`; **Creatures** registers `meat`. You give these items their meaning.
- You define what item fields mean: `food` (hunger restored) and `gear` (director gear score). Add both to the item table in DESIGN.md through the integration lead.
- **Creatures** may also handle `interact` (to talk to villagers). Every handler runs, so return early when the target is not yours.
- **Art** draws your entities and items. Draw placeholders in your `client.js` until they do.

## Rules that matter most for you

- Recipes, items, and entity types live in `shared.js`; changing it restarts the server (state is kept). Handlers and systems live in `server.js`, which hot-swaps without a restart.
- Keys: you have B, N, R, and Tab in addition to E, C, and V.
- Keep per-player timers (hunger ticks, cooldowns) as `_private` fields on the player.

## Testing

Run `START_PHASE=0.65 npm run dev`, build a ring of walls around a campfire before night falls, and watch the slimes fail to get in. Open F3 to see the settlement score rise with every wall.

## Starter prompt for your agent

> Read CLAUDE.md, DESIGN.md, and modules/survival/BRIEF.md. We are the Survival team and work only in modules/survival/. First, add building: B places a wall and N a closed door at game.targetTile(), using the tile names World registers, with a placesTile field in recipes handled by our craft handler. Then let E open and close doors.
