# Team 5: Integration and Art

**Folders:** `server/`, `client/`, `shared/`, `modules/manifest.js` (integration lead) and `modules/art/` (art) · **You own:** the shared server, merging, the core API, sprites, sound, music

## Mission

The integration lead keeps the game running for everyone and keeps five teams from tripping over each other. The art partner makes the island look and sound like one game rather than five, which matters most at 1:50, when everyone watches the final night on the projector.

## Integration lead

**Before the session**

- Push the repo to GitHub and share the link; check that everyone has Node.js 20 or newer.
- Run the shared server with `npm run dev` on the laptop that will drive the projector, and check that another laptop can connect to the network address it prints. Eduroam often blocks laptop-to-laptop traffic; fall back to a phone hotspot or a travel router.
- Choose a seed (`node server/dev.js SEED=...`) whose spawn area looks good, so the demo island is known in advance.
- Settings such as `SEED`, `START_PHASE`, and `DAY_LENGTH` go after `node server/dev.js` as `NAME=value` arguments; that works in PowerShell, cmd, and bash alike.

**During the session**

- Pull from `main` every ten minutes and at each checkpoint. The dev server applies changes by itself: hot swap for team `server.js` files, a browser reload for `client.js` files, a restart that keeps state for `shared.js` files.
- Watch the server terminal and the browser console. Errors in team code are caught and logged at most every five seconds; walk over to the team that owns the file named in the log.
- Run `npm test` before each checkpoint. If `main` breaks and the fix is not obvious within five minutes, `git revert` the commit.
- Handle requests for core changes (`shared/`, `server/`, `client/`) yourself, so only one person edits those files.
- Keep the event table and the cross-team agreements in DESIGN.md current.
- If saved state stops fitting a changed data model, type `f` + Enter in the dev terminal for a fresh world; announce it first.

**Core features you may add if teams ask:** screen shake (`game.camera.shake`), a shared team map of explored tiles, a chat box.

## Art

**What already exists in `modules/art/client.js`:** top-down drawers for every tile and entity in the game (the player with torch, sword, and shield, rotating toward the cursor; slimes with wind-up and stun animations; campfires with flames, embers, and a fuel bar; trees, rocks, water, sand, gravel), spark effects for parries and blocks, and synthesized sounds for every current event, including a war horn for hordes. `blip(freq, duration, type, volume, endFreq)` makes new sounds. Everything is drawn in code, so there are no asset files or licenses to worry about.

**Goals, in priority order**

1. **Keep up with the other teams (by 0:45 and ongoing).** Draw every new tile and entity the moment it appears: building tiles and villages (World), walls and doors (Survival), the snuffer and animals (Creatures), the firebolt (Player). Teams register placeholders in their own `client.js`; your drawers override them because the art module loads last. Ask each team for its type names early. Give every new event a sound.
2. **Atmosphere (by 1:35).** A quiet procedural music loop in WebAudio: a gentle daytime melody and a low drone at night that intensifies during hordes (`net:horde`). Particles: wood chips when harvesting, embers rising from fires. A minimap of explored tiles on **M** (from `game.vision.seen`). Mute on **F4**.
3. **Stretch.** A red tint for blood-moon nights, footprints, ripples in the water, map markers for `game.world.features`.

**Rules that matter most for art**

- Tile drawers run for about a thousand tiles every frame: keep them cheap (a few fills, no gradients, no allocations).
- Read entity fields, never change them; private animation timers (`e._flashUntil`) are fine.
- No copyrighted images, sprites, characters, or music.

## Starter prompt for the art agent

> Read CLAUDE.md, DESIGN.md, and modules/art/BRIEF.md. We are the Art half of the Integration and Art team and work only in modules/art/. First, add top-down drawers for the building tiles wall, door-closed, door-open, and floor in the same style as the existing tiles. Then add a quiet procedural WebAudio music loop that switches from a daytime melody to a low drone at night.
