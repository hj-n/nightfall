// TEAM SURVIVAL (server): harvesting, crafting, placing.
import { registries, onAction } from '../../shared/registry.js';

// Harvest a harvestable tile next to the player: tree -> wood, stone -> stone.
onAction('interact', (game, player, { x, y }) => {
  if (Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y) > 2) return; // too far
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
    if (game.world.isSolid(tx, ty)) return; // no room
    game.spawn(r.places, { x: tx + 0.5, y: ty + 0.5, owner: player.id });
  }
  for (const [item, n] of Object.entries(r.inputs)) game.give(player, item, -n);
  for (const [item, n] of Object.entries(r.output || {})) game.give(player, item, n);
  game.broadcast('crafted', { recipe, by: player.id });
});
