// TEAM PLAYER (server): combat resolution, death and respawn.
import { onAction, registerSystem } from '../../shared/registry.js';

// Melee: hit everything with hp in a short arc in front of the player.
onAction('attack', (game, player) => {
  if ((player._attackCooldown || 0) > game.time) return;
  player._attackCooldown = game.time + 0.35;
  const cx = player.x + player.dir.x * 0.8, cy = player.y + player.dir.y * 0.8;
  for (const e of game.near(cx, cy, 0.9, (e) => e.hp > 0 && e.type !== 'player')) {
    e.hp -= 1;
    game.broadcast('hit', { id: e.id, x: e.x, y: e.y });
    if (e.hp <= 0) {
      game.bus.emit('killed', e, player);
      game.despawn(e.id);
    }
  }
  game.broadcast('swing', { id: player.id });
});

// Respawn dead players at the island center with full health.
registerSystem('respawn', (game) => {
  for (const p of game.players()) {
    if (p.hp > 0) continue;
    p.hp = p.maxHp;
    const spot = game.world.findWalkable();
    game.teleport(p, spot.x, spot.y);
    game.sendTo(p.id, 'died', {});
  }
});
