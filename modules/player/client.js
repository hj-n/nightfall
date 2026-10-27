// TEAM PLAYER (client): local movement and input. We own our own position;
// the server trusts it, so movement feels instant even on bad Wi-Fi.
import { registerClientSystem } from '../../shared/registry.js';

let sendTimer = 0;

registerClientSystem('movement', (game, dt) => {
  const me = game.me;
  if (!me) return;
  const k = game.input;

  let dx = (k.down('KeyD') || k.down('ArrowRight') ? 1 : 0) - (k.down('KeyA') || k.down('ArrowLeft') ? 1 : 0);
  let dy = (k.down('KeyS') || k.down('ArrowDown') ? 1 : 0) - (k.down('KeyW') || k.down('ArrowUp') ? 1 : 0);
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    me.dir = { x: dx, y: dy };
    const step = (me.speed || 5) * dt;
    // move each axis separately so we slide along walls
    if (!game.world.blocked(me.x + dx * step, me.y)) me.x += dx * step;
    if (!game.world.blocked(me.x, me.y + dy * step)) me.y += dy * step;
  }

  sendTimer -= dt;
  if (sendTimer <= 0) {
    sendTimer = 0.05;
    game.send({ t: 'move', x: me.x, y: me.y, dir: me.dir });
  }

  if (k.pressed('Space')) game.sendAction('attack', {});
});
