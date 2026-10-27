// TEAM CREATURES (server): spawning and AI. Creatures are server-owned entities;
// moving them here moves them on every client automatically.
import { registerSystem, onEvent } from '../../shared/registry.js';

const SLIMES_PER_PLAYER = 4;
const WINDUP = 0.4; // seconds of visible wind-up before a bite lands: the parry cue

// Burning campfires (entities with repels: true) keep monsters out of most of their light.
const fires = (game) => [...game.entities.values()].filter((e) => e.repels);
const fireAt = (list, x, y, pad = 0) => list.find((f) => Math.hypot(f.x - x, f.y - y) < f.light * 0.8 + pad);

// At night, keep a few slimes around each player.
registerSystem('night-spawner', (game) => {
  if (!game.timeOfDay().isNight) return;
  const fl = fires(game);
  const slimes = [...game.entities.values()].filter((e) => e.type === 'slime');
  for (const p of game.players()) {
    const nearby = slimes.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) < 16).length;
    if (nearby >= SLIMES_PER_PLAYER || Math.random() > 0.05) continue;
    for (let tries = 0; tries < 10; tries++) { // pick a walkable, unlit spot just out of sight
      const a = Math.random() * Math.PI * 2, d = 9 + Math.random() * 5;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!game.world.blocked(x, y) && !fireAt(fl, x, y, 1)) { game.spawn('slime', { x, y }); break; }
    }
  }
});

// Chase the nearest player within 8 tiles, otherwise wander. Never step into
// fire light; flee it if caught inside (a fire can burn out or be lit nearby).
// Bites are telegraphed: `windup` is public so clients can draw it.
registerSystem('slime-ai', (game, dt) => {
  const fl = fires(game);
  for (const s of game.entities.values()) {
    if (s.type !== 'slime') continue;
    if ((s.stunnedUntil || 0) > game.time) { s.windup = false; continue; }

    let target = null, best = 8;
    for (const p of game.players()) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < best) { best = d; target = p; }
    }

    let dx, dy, speed = s.speed;
    const inside = fireAt(fl, s.x, s.y);
    if (inside) { dx = s.x - inside.x; dy = s.y - inside.y; speed *= 1.3; }
    else if (target) { dx = target.x - s.x; dy = target.y - s.y; }
    else {
      if (!s._wander || Math.random() < 0.01) s._wander = { x: Math.random() - 0.5, y: Math.random() - 0.5 };
      dx = s._wander.x; dy = s._wander.y; speed *= 0.4;
    }

    if (!s.windup) {
      const ok = (x, y) => !game.world.blocked(x, y) && (inside || !fireAt(fl, x, y));
      const base = Math.atan2(dy, dx), step = speed * dt;
      // try straight ahead first, then veer left/right around obstacles
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
        const nx = s.x + Math.cos(base + turn) * step, ny = s.y + Math.sin(base + turn) * step;
        if (ok(nx, ny)) { s.x = nx; s.y = ny; break; }
      }
    }

    // bite: wind up, then land the hit if the target is still in reach
    if (target && !s.windup && best < 0.7 && (s._nextBite || 0) < game.time) {
      s.windup = true;
      s._biteAt = game.time + WINDUP;
    }
    if (s.windup && game.time >= s._biteAt) {
      s.windup = false;
      s._nextBite = game.time + 1;
      if (target && Math.hypot(target.x - s.x, target.y - s.y) < 0.9) game.damage(target, s.damage, s);
    }
  }
});

// Slimes melt at dawn.
onEvent('dawn', (game) => {
  for (const e of [...game.entities.values()]) if (e.type === 'slime') game.despawn(e.id);
});
