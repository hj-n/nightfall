// TEAM CREATURES (server): spawning and AI. Creatures are server-owned entities;
// moving them here moves them on every client automatically.
import { registerSystem, onEvent } from '../../shared/registry.js';

const SLIMES_PER_PLAYER = 4;

// At night, keep a few slimes around each player.
registerSystem('night-spawner', (game) => {
  if (!game.timeOfDay().isNight) return;
  const slimes = [...game.entities.values()].filter((e) => e.type === 'slime');
  for (const p of game.players()) {
    const nearby = slimes.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) < 16).length;
    if (nearby >= SLIMES_PER_PLAYER || Math.random() > 0.05) continue;
    for (let tries = 0; tries < 10; tries++) { // pick a walkable spot just off screen
      const a = Math.random() * Math.PI * 2, d = 9 + Math.random() * 5;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!game.world.blocked(x, y)) { game.spawn('slime', { x, y }); break; }
    }
  }
});

// Chase the nearest player within 8 tiles, otherwise wander. Bite on contact.
registerSystem('slime-ai', (game, dt) => {
  for (const s of game.entities.values()) {
    if (s.type !== 'slime') continue;
    let target = null, best = 8;
    for (const p of game.players()) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < best) { best = d; target = p; }
    }
    let dx, dy;
    if (target) { dx = target.x - s.x; dy = target.y - s.y; }
    else {
      if (!s._wander || Math.random() < 0.01) s._wander = { x: Math.random() - 0.5, y: Math.random() - 0.5 };
      dx = s._wander.x; dy = s._wander.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    const step = s.speed * dt * (target ? 1 : 0.4);
    const nx = s.x + (dx / len) * step, ny = s.y + (dy / len) * step;
    if (!game.world.blocked(nx, s.y)) s.x = nx;
    if (!game.world.blocked(s.x, ny)) s.y = ny;

    if (target && best < 0.6 && (s._biteAt || 0) < game.time) {
      s._biteAt = game.time + 1;
      target.hp -= s.damage;
      game.broadcast('hit', { id: target.id, x: target.x, y: target.y });
    }
  }
});

// Slimes melt at dawn.
onEvent('dawn', (game) => {
  for (const e of [...game.entities.values()]) if (e.type === 'slime') game.despawn(e.id);
});
