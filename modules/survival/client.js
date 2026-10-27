// TEAM SURVIVAL (client): input for harvesting/crafting, target highlight, inventory HUD.
import { registries, registerClientSystem, registerHud } from '../../shared/registry.js';
import { TILE_PX } from '../../shared/config.js';

registerClientSystem('survival-input', (game) => {
  if (!game.me) return;
  if (game.input.pressed('KeyE')) game.sendAction('interact', game.targetTile());
  if (game.input.pressed('KeyC')) game.sendAction('craft', { recipe: 'campfire' });
  if (game.input.pressed('KeyV')) game.sendAction('craft', { recipe: 'shield' });
});

// Outline the tile that E would act on.
registerHud('target', (ctx, game) => {
  if (!game.me) return;
  const t = game.targetTile();
  const useful = game.world.tile(t.x, t.y)?.harvest ||
    [...game.entities.values()].some((e) => e.type === 'campfire' && Math.floor(e.x) === t.x && Math.floor(e.y) === t.y);
  const p = game.worldToScreen(t.x, t.y);
  ctx.strokeStyle = useful ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x + 1, p.y + 1, TILE_PX - 2, TILE_PX - 2);
});

registerHud('inventory', (ctx, game) => {
  const inv = game.me?.inventory || {};
  const items = Object.entries(inv);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 160, 26 + items.length * 20);
  ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${game.me?.hp ?? '-'} / ${game.me?.maxHp ?? '-'}`, 16, 13);
  items.forEach(([name, n], i) => {
    ctx.fillStyle = registries.items.get(name)?.color || '#ccc';
    ctx.fillRect(16, 36 + i * 20, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${name} x${n}`, 34, 35 + i * 20);
  });
});
