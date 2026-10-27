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
import { createVision, updateVision, canSee } from './core/vision.js';
import { THEME, font } from './core/theme.js';
import { loadSettings, updateSettings } from './core/settings.js';

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
  vision: null, // fog of war, see core/vision.js
  notices: [],  // on-screen messages, see notify()
  screen: { w: 0, h: 0 },
  theme: THEME, // Halloween fonts and colors, see core/theme.js
  font,         // game.font(14) or game.font(32, 'display')
  settings: {}, // this viewer's settings (Esc panel), see core/settings.js
  ui: null,     // name of the open panel ('settings', 'inventory', ...); world input pauses while set
  selectedSlot: 0, // hotbar slot shown as selected (ahead of the server's me.selected)
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
  /** Tile the player means to act on: under the mouse if within reach, else the facing tile */
  targetTile(reach = 1.8) {
    const me = this.me, m = this.input.mouse;
    if (m.active) {
      const p = this.screenToWorld(m.x, m.y);
      const tx = Math.floor(p.x), ty = Math.floor(p.y);
      if (Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y) <= reach) return { x: tx, y: ty };
    }
    return this.facingTile(me);
  },
  /** Show a message at the top of the screen for a few seconds */
  notify(text, seconds = 4, color = '#fff') { this.notices.push({ text, color, until: performance.now() + seconds * 1000 }); },
  /** Fog of war: can we see world position (x, y) right now? */
  canSee(x, y) { return canSee(this, x, y); },
};
window.game = game; // handy for poking at in the browser console

game.failedModules = await loadModules('client', (p) => import(`../modules/${p}`));
loadSettings(game);
_attachListeners(game);
document.fonts?.load(font(20, 'display'));
document.fonts?.load(font(14));
game.bus.on('net:hotswap', ({ failed }) =>
  game.notify(failed.length ? `Server code updated; ${failed.join(', ')} failed to load (see server log)` : 'Server code updated', 3,
    failed.length ? '#f88' : '#9cf'));
game.bus.on('net:dusk', ({ day }) => game.notify(`Night ${day} falls`, 4, THEME.colors.moon));
game.bus.on('net:dawn', ({ day }) => game.notify(`Day ${day + 1} dawns`, 4, THEME.colors.candle));

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
    game.vision ||= createVision(game.world);
    updateSettings(game);
    for (const s of registries.clientSystems) safely(s.name, s.fn, game, dt);
    // smooth other entities toward their latest server position
    const k = Math.min(1, dt * 12);
    for (const e of game.entities.values()) {
      if (e.id === game.myId) { e._rx = e.x; e._ry = e.y; continue; }
      e._rx += (e.x - e._rx) * k;
      e._ry += (e.y - e._ry) * k;
    }
    updateVision(game);
  }
  render(game, ctx, game.screen.w, game.screen.h);
  game.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const params = new URLSearchParams(location.search);
const name = params.get('name') || prompt('Your name?') || `player${Math.floor(Math.random() * 100)}`;
if (params.get('name') !== name) { // keep the name in the URL so reloads resume the same player
  params.set('name', name);
  history.replaceState(null, '', `?${params}`);
}
await connect(game, name);
game.bus.emit('ready');
