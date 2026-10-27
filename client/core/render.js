// World, entity, lighting and HUD rendering. Owned by: Integration.
// Teams customize visuals through registerDrawer / registerHud, not here.
import { TILE_PX } from '../../shared/config.js';
import { registries } from '../../shared/registry.js';
import { safely } from '../../shared/safe.js';

const lightCanvas = document.createElement('canvas');
const lctx = lightCanvas.getContext('2d');
const fogCanvas = document.createElement('canvas'); // one pixel per tile, scaled up smoothly
const fctx = fogCanvas.getContext('2d');
const FOG_SEEN = 170;   // alpha over tiles seen before but not visible now
const FOG_UNSEEN = 255; // alpha over tiles never seen

function resetText(ctx) {
  ctx.font = '14px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.globalAlpha = 1;
}

function defaultDrawer(ctx, e, sx, sy, size, game) {
  const def = registries.entityTypes.get(e.type)?.defaults;
  ctx.fillStyle = e.color || def?.color || '#ccc';
  ctx.beginPath();
  ctx.arc(sx, sy, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

export function render(game, ctx, w, h) {
  const T = TILE_PX;
  const me = game.me;
  const cam = game.camera;
  if (me) { cam.x = me.x; cam.y = me.y; }

  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, 0, w, h);
  if (!game.world) return drawStatus(ctx, w, h, 'Connecting...');

  // --- tiles ---
  const x0 = Math.floor(cam.x - w / 2 / T) - 1, x1 = Math.ceil(cam.x + w / 2 / T) + 1;
  const y0 = Math.floor(cam.y - h / 2 / T) - 1, y1 = Math.ceil(cam.y + h / 2 / T) + 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tile = game.world.tile(tx, ty);
      if (!tile) continue;
      const px = Math.floor((tx - cam.x) * T + w / 2);
      const py = Math.floor((ty - cam.y) * T + h / 2);
      const drawer = registries.drawers.get(`tile:${tile.name}`);
      if (drawer) safely(`drawer tile:${tile.name}`, drawer, ctx, tile, px, py, T, tx, ty, game);
      else { ctx.fillStyle = tile.color; ctx.fillRect(px, py, T, T); }
    }
  }

  // --- entities, back to front (only what we can see) ---
  const list = [...game.entities.values()].sort((a, b) => a._ry - b._ry);
  for (const e of list) {
    if (e.id !== game.myId && !game.canSee(e._rx, e._ry)) continue;
    const sx = (e._rx - cam.x) * T + w / 2;
    const sy = (e._ry - cam.y) * T + h / 2;
    if (sx < -2 * T || sy < -2 * T || sx > w + 2 * T || sy > h + 2 * T) continue;
    const drawer = registries.drawers.get(e.type) || defaultDrawer;
    ctx.save();
    resetText(ctx);
    safely(`drawer ${e.type}`, drawer, ctx, e, sx, sy, T, game);
    ctx.restore();
  }

  // --- night: darkness with holes cut by entities that have `light` (radius in tiles) ---
  const { darkness } = game.timeOfDay();
  if (darkness > 0.01) {
    if (lightCanvas.width !== w || lightCanvas.height !== h) { lightCanvas.width = w; lightCanvas.height = h; }
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, w, h);
    lctx.fillStyle = `rgba(4, 6, 20, ${darkness})`;
    lctx.fillRect(0, 0, w, h);
    lctx.globalCompositeOperation = 'destination-out';
    for (const e of list) {
      if (!e.light) continue;
      const sx = (e._rx - cam.x) * T + w / 2, sy = (e._ry - cam.y) * T + h / 2;
      const r = e.light * T * (1 + 0.03 * Math.sin(performance.now() / 120 + e.id)); // slight flicker
      const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(sx - r, sy - r, 2 * r, 2 * r);
    }
    ctx.drawImage(lightCanvas, 0, 0);
  }

  // --- fog of war ---
  if (game.vision) {
    const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
    if (fogCanvas.width !== cols || fogCanvas.height !== rows) { fogCanvas.width = cols; fogCanvas.height = rows; }
    const img = fctx.createImageData(cols, rows);
    const { seen, visible } = game.vision;
    const W = game.world.w;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = x0 + c, ty = y0 + r, o = (r * cols + c) * 4;
        let a = FOG_UNSEEN;
        if (game.world.inBounds(tx, ty)) {
          const i = ty * W + tx;
          a = visible[i] ? 0 : seen[i] ? FOG_SEEN : FOG_UNSEEN;
        }
        img.data[o] = 4; img.data[o + 1] = 5; img.data[o + 2] = 12; img.data[o + 3] = a;
      }
    }
    fctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogCanvas, (x0 - cam.x) * T + w / 2, (y0 - cam.y) * T + h / 2, cols * T, rows * T);
  }

  // --- HUDs ---
  for (const hud of registries.huds) {
    ctx.save();
    resetText(ctx);
    safely(hud.name, hud.fn, ctx, game, w, h);
    ctx.restore();
  }
  ctx.save();
  drawCoreHud(ctx, game, w, h);
  ctx.restore();
}

function drawCoreHud(ctx, game, w, h) {
  const tod = game.timeOfDay();
  const players = [...game.entities.values()].filter((e) => e.type === 'player');
  ctx.font = '14px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(w - 190, 8, 182, 22 + players.length * 18);
  ctx.fillStyle = tod.isNight ? '#9ab' : '#fe8';
  ctx.fillText(`Day ${tod.day}  ${tod.clock}${tod.isNight ? '  night' : ''}`, w - 16, 12);
  ctx.fillStyle = '#ddd';
  players.forEach((p, i) => ctx.fillText(`${p.name}${p.id === game.myId ? ' (you)' : ''}`, w - 16, 32 + i * 18));

  // key hints, wrapped onto as many lines as the screen width needs
  ctx.font = '13px ui-monospace, monospace';
  const lines = [''];
  for (const k of registries.keyHints) {
    const part = `${k.key} ${k.label}`;
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]}   ${part}` : part;
    if (ctx.measureText(next).width > w - 40 && lines[lines.length - 1]) lines.push(part);
    else lines[lines.length - 1] = next;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h - 10 - (lines.length - 1 - i) * 17));

  if (game.failedModules.length) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#f55';
    ctx.fillText(`Failed to load: ${game.failedModules.join(', ')} (see console)`, 10, h - 50);
  }
  if (!game.connected) drawStatus(ctx, w, h, 'Connection lost. Reconnecting...');
}

function drawStatus(ctx, w, h, text) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, h / 2 - 30, w, 60);
  ctx.fillStyle = '#fff';
  ctx.font = '20px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
}
