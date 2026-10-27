// TEAM PLAYER (server): melee, blocking, parrying, death and respawn.
// All damage goes through game.damage(), which emits a 'damage' event first;
// the guard logic below cancels hits by listening to it.
import { onAction, onEvent, registerSystem } from '../../shared/registry.js';

const PARRY_WINDOW = 0.25;   // seconds after pressing guard (no shield)
const PARRY_COOLDOWN = 0.6;  // so mashing RMB does not parry everything
const STUN = 1.2;            // seconds a parried attacker stays stunned

// Melee: hit everything with hp in a short arc in front of the player.
onAction('attack', (game, player) => {
  if ((player._attackCooldown || 0) > game.time || player.guarding) return;
  player._attackCooldown = game.time + 0.35;
  const cx = player.x + player.dir.x * 0.8, cy = player.y + player.dir.y * 0.8;
  for (const e of game.near(cx, cy, 0.9, (e) => e.hp > 0 && e.type !== 'player')) {
    if (game.damage(e, 1, player)) game.knockback(e, player.x, player.y, 0.6);
  }
  game.broadcast('swing', { id: player.id });
});

onAction('guard', (game, player, { on }) => {
  player.guarding = !!on;
  if (on && game.time >= (player._parryReadyAt || 0)) {
    player._parryUntil = game.time + PARRY_WINDOW;
    player._parryReadyAt = game.time + PARRY_COOLDOWN;
  }
});

// Guarding players cancel hits that come from the front.
onEvent('damage', (game, hit) => {
  const t = hit.target, src = hit.source;
  if (t.type !== 'player' || !t.guarding || !src || !t.dir) return;
  const dx = src.x - t.x, dy = src.y - t.y, len = Math.hypot(dx, dy) || 1;
  if ((dx / len) * t.dir.x + (dy / len) * t.dir.y < 0.35) return; // attack from the side or behind

  if (game.has(t, 'shield')) {
    hit.cancelled = true;
    game.knockback(src, t.x, t.y, 0.4);
    game.broadcast('block', { id: t.id, x: (t.x + src.x) / 2, y: (t.y + src.y) / 2 });
  } else if (game.time < (t._parryUntil || 0)) {
    hit.cancelled = true;
    game.knockback(src, t.x, t.y, 1.5);
    src.stunnedUntil = game.time + STUN; // public, so clients can draw it; creature AI respects it
    game.broadcast('parry', { id: t.id, target: src.id, x: (t.x + src.x) / 2, y: (t.y + src.y) / 2 });
  }
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
