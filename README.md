# Nightfall

A multiplayer top-down survival game, built in two hours by ten people at the CA3 retreat. Harvest, build, and survive the night on a procedural island.

## Quick start

Requires Node.js 18 or newer.

```
npm install
npm run dev
```

Open `http://localhost:8080/?name=YourName`. Open a second tab to get a second player.

Controls: **WASD** move, **mouse** aim, **left click** swing, **right click** (hold) block or parry, **E** harvest or feed a fire, **C** campfire, **V** shield. `DESIGN.md` has the full list.

## For jam participants

1. Find your team and folder in `DESIGN.md`.
2. Point your coding agent at `CLAUDE.md` (agents other than Claude Code read `AGENTS.md`, which points there).
3. Work only in `modules/<your team>/`, commit often, and `git pull --rebase` before you push.

`npm run dev` restarts the server on every code change and keeps the game state. `npm test` runs the headless tests. `START_TIME=160 npm run dev` starts at dusk.
