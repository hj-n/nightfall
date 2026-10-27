// TEAM ART & SOUND (client): every sprite is drawn in code (no image files,
// no licensing questions) and every sound is synthesized with WebAudio.
// Replace and extend freely; anything without a drawer falls back to a circle.
import { registerDrawer, onEvent } from '../../shared/registry.js';
import { hash2 } from '../../shared/rng.js';

// ---------------------------------------------------------------- tiles ----

registerDrawer('tile:grass', (ctx, tile, px, py, T, tx, ty) => {
  ctx.fillStyle = tile.color;
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 3; i++) {
    const h = hash2(tx * 3 + i, ty * 7 - i);
    ctx.fillRect(px + h * (T - 3), py + hash2(ty + i, tx) * (T - 3), 2, 4);
  }
});

registerDrawer('tile:tree', (ctx, tile, px, py, T, tx, ty) => {
  ctx.fillStyle = '#4e8a3a';
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(px + T * 0.42, py + T * 0.55, T * 0.16, T * 0.4);
  const v = hash2(tx, ty, 9);
  ctx.fillStyle = v < 0.5 ? '#2f5e25' : '#356b2a';
  ctx.beginPath();
  ctx.arc(px + T / 2, py + T * 0.42, T * (0.36 + v * 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(px + T * 0.4, py + T * 0.32, T * 0.14, 0, Math.PI * 2);
  ctx.fill();
});

registerDrawer('tile:stone', (ctx, tile, px, py, T, tx, ty) => {
  ctx.fillStyle = tile.color;
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(px, py + T - 4, T, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(px + hash2(tx, ty) * T * 0.6, py + 4, T * 0.3, 3);
});

registerDrawer('tile:water', (ctx, tile, px, py, T, tx, ty) => {
  ctx.fillStyle = tile.color;
  ctx.fillRect(px, py, T, T);
  const t = performance.now() / 900;
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  const off = Math.sin(t + tx * 0.7 + ty * 1.3) * 4;
  ctx.fillRect(px + 6 + off, py + T * 0.4, T * 0.35, 2);
});

// ------------------------------------------------------------- entities ----

const flashing = (e) => (e._flashUntil || 0) > performance.now();

registerDrawer('player', (ctx, e, x, y, T) => {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + T * 0.3, T * 0.28, T * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flashing(e) ? '#fff' : e.color;
  ctx.fillRect(x - T * 0.22, y - T * 0.15, T * 0.44, T * 0.45);          // body
  ctx.fillStyle = '#f1c9a0';
  ctx.beginPath(); ctx.arc(x, y - T * 0.28, T * 0.2, 0, Math.PI * 2); ctx.fill(); // head
  const d = e.dir || { x: 0, y: 1 };
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x + d.x * T * 0.1, y - T * 0.28 + d.y * T * 0.08, T * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.font = '12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#fff';
  ctx.fillText(e.name, x, y - T * 0.5);
});

registerDrawer('slime', (ctx, e, x, y, T) => {
  const b = Math.abs(Math.sin(performance.now() / 180 + e.id)) * T * 0.08;
  ctx.fillStyle = flashing(e) ? '#fff' : e.color;
  ctx.beginPath(); ctx.ellipse(x, y + T * 0.1 - b, T * 0.32, T * 0.24 + b * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(x - T * 0.12, y - b, T * 0.06, T * 0.08);
  ctx.fillRect(x + T * 0.06, y - b, T * 0.06, T * 0.08);
});

registerDrawer('campfire', (ctx, e, x, y, T) => {
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(x - T * 0.3, y + T * 0.12, T * 0.6, T * 0.1);
  ctx.fillRect(x - T * 0.05, y + T * 0.0, T * 0.1, T * 0.3);
  const f = Math.sin(performance.now() / 70 + e.id) * T * 0.05;
  ctx.fillStyle = '#f80';
  ctx.beginPath(); ctx.ellipse(x, y - T * 0.02, T * 0.18, T * 0.26 + f, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fd4';
  ctx.beginPath(); ctx.ellipse(x, y + T * 0.04, T * 0.08, T * 0.14 + f * 0.5, 0, 0, Math.PI * 2); ctx.fill();
});

// ---------------------------------------------------------------- sound ----

let audio = null;
addEventListener('keydown', () => { // browsers only allow audio after a user gesture
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (AC) audio ||= new AC();
}, { once: true });

/** Simple synth blip: frequency in Hz, duration in s, oscillator type, volume, end frequency */
export function blip(freq = 440, dur = 0.1, type = 'square', vol = 0.08, endFreq = freq) {
  if (!audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur);
}

onEvent('net:hit', (game, { id }) => {
  const e = game.entities.get(id);
  if (e) e._flashUntil = performance.now() + 120;
  blip(id === game.myId ? 120 : 220, 0.12, 'square', 0.08, 60);
});
onEvent('net:swing', (game, { id }) => { if (id === game.myId) blip(600, 0.06, 'triangle', 0.05, 300); });
onEvent('net:harvested', (game, { by }) => { if (by === game.myId) blip(300, 0.08, 'square', 0.06, 180); });
onEvent('net:crafted', () => blip(500, 0.25, 'triangle', 0.07, 900));
onEvent('net:dusk', () => blip(110, 1.5, 'sine', 0.12, 55));
onEvent('net:dawn', () => blip(330, 1.0, 'sine', 0.08, 660));
onEvent('net:died', () => blip(200, 0.8, 'sawtooth', 0.08, 40));
