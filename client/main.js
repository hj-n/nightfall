// Client entry point. Owned by: Integration.
import { TILE_PX } from '../shared/config.js';
import { registries, _attachListeners } from '../shared/registry.js';
import { createBus } from '../shared/events.js';
import { timeOfDay } from '../shared/time.js';
import { safely } from '../shared/safe.js';
import { loadModules } from '../shared/loader.js';
import { createInput } from './core/input.js';
import { connect } from './core/net.js';
import { render } from './core/render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// The client-side game object. Client systems, drawers and HUDs receive it.
const game = {
  world: null,
  entities: new Map(),
  myId: null,
  time: 0,
  connected: false,
  failedModules: [],
  bus: createBus(),
  input: createInput(canvas),
  camera: { x: 0, y: 0 },
  screen: { w: 0, h: 0 },
  send: () => {},

  get me() { return this.entities.get(this.myId); },
  timeOfDay() { return timeOfDay(this.time); },

  /** Ask the server to do something; handled by onAction(name, ...) in some server.js */
  sendAction(name, data = {}) { this.send({ t: 'action', name, data }); },

  /** Screen pixel -> world tile coordinates (floats) */
  screenToWorld(sx, sy) {
    return { x: this.camera.x + (sx - this.screen.w / 2) / TILE_PX, y: this.camera.y + (sy - this.screen.h / 2) / TILE_PX };
  },
  /** World coordinates -> screen pixel */
  worldToScreen(x, y) {
    return { x: (x - this.camera.x) * TILE_PX + this.screen.w / 2, y: (y - this.camera.y) * TILE_PX + this.screen.h / 2 };
  },
  /** Integer tile the entity is facing */
  facingTile(e = this.me) {
    return { x: Math.floor(e.x + e.dir.x * 0.8), y: Math.floor(e.y + e.dir.y * 0.8) };
  },
};
window.game = game; // handy for poking at in the browser console

game.failedModules = await loadModules('client', (p) => import(`../modules/${p}`));
_attachListeners(game);

function resize() {
  canvas.width = game.screen.w = innerWidth;
  canvas.height = game.screen.h = innerHeight;
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt; // advance locally between snapshots

  if (game.world) {
    for (const s of registries.clientSystems) safely(s.name, s.fn, game, dt);
    // smooth other entities toward their latest server position
    const k = Math.min(1, dt * 12);
    for (const e of game.entities.values()) {
      if (e.id === game.myId) { e._rx = e.x; e._ry = e.y; continue; }
      e._rx += (e.x - e._rx) * k;
      e._ry += (e.y - e._ry) * k;
    }
  }
  render(game, ctx, game.screen.w, game.screen.h);
  game.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const name = new URLSearchParams(location.search).get('name') || prompt('Your name?') || `player${Math.floor(Math.random() * 100)}`;
await connect(game, name);
game.bus.emit('ready');
