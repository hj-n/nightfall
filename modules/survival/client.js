// TEAM SURVIVAL (client): input for harvesting/crafting, inventory HUD.
import { registries, registerClientSystem, registerHud } from '../../shared/registry.js';

registerClientSystem('survival-input', (game) => {
  if (!game.me) return;
  if (game.input.pressed('KeyE')) game.sendAction('interact', game.facingTile());
  if (game.input.pressed('KeyC')) game.sendAction('craft', { recipe: 'campfire' });
});

registerHud('inventory', (ctx, game) => {
  const inv = game.me?.inventory || {};
  const items = Object.entries(inv);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 160, 26 + items.length * 20);
  ctx.font = '14px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${game.me?.hp ?? '-'} / ${game.me?.maxHp ?? '-'}`, 16, 13);
  items.forEach(([name, n], i) => {
    ctx.fillStyle = registries.items.get(name)?.color || '#ccc';
    ctx.fillRect(16, 36 + i * 20, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${name} x${n}`, 34, 35 + i * 20);
  });
});
