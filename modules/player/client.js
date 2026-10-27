// TEAM PLAYER (client): local movement, aiming and combat input. We own our
// own position; the server trusts it, so movement feels instant on bad Wi-Fi.
// Shift and Space mirror the mouse buttons for people on trackpads.
import { registerClientSystem } from '../../shared/registry.js';

let sendTimer = 0;
let guarding = false;

registerClientSystem('movement', (game, dt) => {
  const me = game.me;
  if (!me) return;
  const k = game.input;

  // --- guard (block with a shield, parry without one) ---
  const guard = k.mouseDown(2) || k.down('ShiftLeft') || k.down('ShiftRight');
  if (guard !== guarding) {
    guarding = guard;
    me.guarding = guard;
    game.sendAction('guard', { on: guard });
  }

  // --- move with WASD ---
  let dx = (k.down('KeyD') || k.down('ArrowRight') ? 1 : 0) - (k.down('KeyA') || k.down('ArrowLeft') ? 1 : 0);
  let dy = (k.down('KeyS') || k.down('ArrowDown') ? 1 : 0) - (k.down('KeyW') || k.down('ArrowUp') ? 1 : 0);
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    const step = (me.speed || 5) * (guarding ? 0.5 : 1) * dt;
    // move each axis separately so we slide along walls
    if (!game.world.blocked(me.x + dx * step, me.y)) me.x += dx * step;
    if (!game.world.blocked(me.x, me.y + dy * step)) me.y += dy * step;
  }

  // --- face the mouse (or the walking direction until the mouse moves) ---
  if (k.mouse.active) {
    const m = game.screenToWorld(k.mouse.x, k.mouse.y);
    const ax = m.x - me.x, ay = m.y - me.y, len = Math.hypot(ax, ay);
    if (len > 0.05) me.dir = { x: ax / len, y: ay / len };
  } else if (dx || dy) {
    me.dir = { x: dx, y: dy };
  }

  sendTimer -= dt;
  if (sendTimer <= 0) {
    sendTimer = 0.05;
    game.send({ t: 'move', x: me.x, y: me.y, dir: me.dir });
  }

  if (k.clicked(0) || k.pressed('Space')) game.sendAction('attack', {});
});
