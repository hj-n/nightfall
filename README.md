# Nightfall

A Halloween multiplayer top-down survival game, built in two hours by 10 to 13 people at the CA3 retreat. Mine, build, carve jack-o-lanterns, and survive the night on a procedural island.

## Quick start

Requires Node.js 20 or newer.

```
npm install
npm run dev
```

Open `http://localhost:8080/?name=YourName`. Open a second tab to get a second player.

Controls: **WASD** move (W toward the cursor), **mouse** aim, **left click** (hold) mine or swing, **right click** feed a fire, place the held item, or guard, **Shift** guard, **1-9** or **wheel** hotbar, **E** inventory and crafting, **C** campfire, **V** shield, **Esc** settings, **F3** director debug. `DESIGN.md` has the full list.

## For jam participants

1. Find your team and folder in `DESIGN.md`. Teams are pairs; with more than ten people, some become trios.
2. Point your coding agent at `CLAUDE.md` (agents other than Claude Code read `AGENTS.md`, which points there).
3. Work only in `modules/<your team>/`. In Claude Code, `/ship` commits your folder, pulls, and pushes; `/sync` pulls everyone else's work. With other agents, say "ship" or "sync".

`npm run dev` applies code changes to the running game (hot swap, or a restart that keeps the game state). `npm test` runs the headless tests. `npm run dev:night` starts at dusk with three-minute days. Other settings work in any shell as arguments: `node server/dev.js SEED=1234 START_PHASE=0.65`.
