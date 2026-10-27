// TEAM WORLD: terrain, biomes, villages, dungeons, resource placement.
// Runs on server AND every client with the same seed, so use ONLY the `rng`
// argument and the noise helpers in shared/rng.js (never Math.random).
import { registerTile, registerWorldPass } from '../../shared/registry.js';
import { fbm, hash2 } from '../../shared/rng.js';

// --- tiles (ids are assigned in registration order; never register conditionally) ---
registerTile('water',  { color: '#2b5d9b', solid: true });
registerTile('sand',   { color: '#d8c98a' });
registerTile('grass',  { color: '#4e8a3a' });
registerTile('tree',   { color: '#2f5e25', solid: true, harvest: { item: 'wood', becomes: 'grass' } });
registerTile('stone',  { color: '#7b7b80', solid: true, harvest: { item: 'stone', becomes: 'gravel' } });
registerTile('gravel', { color: '#5e5a55' });

// --- pass 1: island terrain from elevation and moisture noise ---
registerWorldPass('terrain', (world, rng) => {
  const s = world.seed;
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const nx = x / world.w - 0.5, ny = y / world.h - 0.5;
      const falloff = Math.hypot(nx, ny) * 1.9;                 // edges sink into the sea
      const elev = fbm(x / 28, y / 28, s, 5) - falloff * falloff * 0.9 + 0.15;
      const moist = fbm(x / 20, y / 20, s + 7, 3);
      let tile = 'grass';
      if (elev < 0.30) tile = 'water';
      else if (elev < 0.34) tile = 'sand';
      else if (elev > 0.64) tile = 'stone';
      else if (moist > 0.56 && hash2(x, y, s) < 0.45) tile = 'tree';   // forests
      else if (hash2(x, y, s + 1) < 0.02) tile = 'tree';               // lone trees
      world.set(x, y, tile);
    }
  }
}, { order: 0 });

// TODO(world team): more passes, e.g.
// registerWorldPass('villages', (world, rng) => { ... }, { order: 200 });
// registerWorldPass('dungeons', (world, rng) => { ... }, { order: 300 });
// Keep the area around the island center walkable: players spawn there.
