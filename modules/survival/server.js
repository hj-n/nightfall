// TEAM SURVIVAL (server): harvesting, crafting, placing, fire fuel.
import { registries, onAction, registerSystem } from '../../shared/registry.js';

const FUEL_PER_WOOD = 20; // seconds of burn time per wood

// E on a tile: feed a campfire standing there, or harvest the tile.
onAction('interact', (game, player, { x, y }) => {
  if (Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y) > 2) return; // too far

  const fire = game.near(x + 0.5, y + 0.5, 0.9, (e) => e.type === 'campfire')[0];
  if (fire) {
    if (!game.has(player, 'wood') || fire.fuel >= fire.maxFuel) return;
    game.give(player, 'wood', -1);
    fire.fuel = Math.min(fire.maxFuel, fire.fuel + FUEL_PER_WOOD);
    game.broadcast('fed', { id: fire.id, by: player.id });
    return;
  }

  const tile = game.world.tile(x, y);
  if (!tile?.harvest) return;
  game.give(player, tile.harvest.item, tile.harvest.count || 1);
  game.setTile(x, y, tile.harvest.becomes);
  game.broadcast('harvested', { x, y, item: tile.harvest.item, by: player.id });
});

onAction('craft', (game, player, { recipe }) => {
  const r = registries.recipes.get(recipe);
  if (!r) return;
  for (const [item, n] of Object.entries(r.inputs)) if (!game.has(player, item, n)) return;

  if (r.places) {
    const tx = Math.floor(player.x + player.dir.x), ty = Math.floor(player.y + player.dir.y);
    if (game.world.isSolid(tx, ty) || game.near(tx + 0.5, ty + 0.5, 0.5).length) return; // no room
    game.spawn(r.places, { x: tx + 0.5, y: ty + 0.5, owner: player.id });
  }
  for (const [item, n] of Object.entries(r.inputs)) game.give(player, item, -n);
  for (const [item, n] of Object.entries(r.output || {})) game.give(player, item, n);
  game.broadcast('crafted', { recipe, by: player.id });
});

// Campfires burn down. Light (and the monster-free zone) shrinks in the last
// 30 seconds; at zero fuel the fire is embers that no longer repel anything.
registerSystem('fire', (game, dt) => {
  for (const e of game.entities.values()) {
    if (e.type !== 'campfire') continue;
    const wasBurning = e.fuel > 0;
    e.fuel = Math.max(0, e.fuel - dt);
    e.repels = e.fuel > 0;
    e.light = e.fuel > 0 ? 2.5 + 3.5 * Math.min(1, e.fuel / 30) : 0.7;
    if (wasBurning && !e.repels) game.broadcast('fireOut', { id: e.id, x: e.x, y: e.y });
  }
});
