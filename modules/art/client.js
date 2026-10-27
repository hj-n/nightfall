// TEAM ART & SOUND (client): every sprite is drawn in code (no image files,
// no licensing questions) and every sound is synthesized with WebAudio.
// Replace and extend freely; anything without a drawer falls back to a circle.
import { registerDrawer, registerHud, onEvent } from '../../shared/registry.js';
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

const now = () => performance.now();
const flashing = (e) => (e._flashUntil || 0) > now();

registerDrawer('player', (ctx, e, x, y, T, game) => {
  const d = e.dir || { x: 0, y: 1 };
  const side = { x: -d.y, y: d.x };            // perpendicular: right hand at +side, left at -side
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + T * 0.3, T * 0.28, T * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  // torch in the left hand
  const tx = x - side.x * T * 0.32 + d.x * T * 0.08, ty = y - side.y * T * 0.32 + d.y * T * 0.08;
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(tx - 2, ty - T * 0.1, 4, T * 0.28);
  ctx.fillStyle = Math.sin(now() / 60 + e.id) > 0 ? '#ffb030' : '#ff8a1a';
  ctx.beginPath(); ctx.arc(tx, ty - T * 0.14, T * 0.08, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = flashing(e) ? '#fff' : e.color;
  ctx.fillRect(x - T * 0.22, y - T * 0.15, T * 0.44, T * 0.45);                    // body
  ctx.fillStyle = '#f1c9a0';
  ctx.beginPath(); ctx.arc(x, y - T * 0.28, T * 0.2, 0, Math.PI * 2); ctx.fill();   // head
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x + d.x * T * 0.1, y - T * 0.28 + d.y * T * 0.08, T * 0.04, 0, Math.PI * 2); ctx.fill();

  // shield: at the side normally, in front while guarding
  if (e.inventory?.shield) {
    const f = e.guarding ? 0.4 : 0.05, s = e.guarding ? 0.05 : 0.32;
    const sx = x + d.x * T * f + side.x * T * s, sy = y + d.y * T * f + side.y * T * s;
    ctx.fillStyle = '#a0703a';
    ctx.strokeStyle = '#d9b26f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, T * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (e.guarding) {
    // parry stance: a short bright line in front
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + d.x * T * 0.4 - side.x * T * 0.2, y + d.y * T * 0.4 - side.y * T * 0.2);
    ctx.lineTo(x + d.x * T * 0.4 + side.x * T * 0.2, y + d.y * T * 0.4 + side.y * T * 0.2);
    ctx.stroke();
  }

  // sword swing arc
  const swing = (e._swingUntil || 0) - now();
  if (swing > 0) {
    const a = Math.atan2(d.y, d.x);
    ctx.strokeStyle = `rgba(255,255,255,${swing / 150})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, T * 0.8, a - 0.9, a + 0.9); ctx.stroke();
  }

  ctx.font = '12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#fff';
  ctx.fillText(e.name, x, y - T * 0.5);
});

registerDrawer('slime', (ctx, e, x, y, T, game) => {
  const stunned = (e.stunnedUntil || 0) > game.time;
  const b = stunned ? 0 : Math.abs(Math.sin(now() / 180 + e.id)) * T * 0.08;
  const swell = e.windup ? 1.25 : 1;           // wind-up before a bite: the cue to parry
  ctx.fillStyle = flashing(e) ? '#fff' : e.windup ? '#d94' : e.color;
  ctx.beginPath(); ctx.ellipse(x, y + T * 0.1 - b, T * 0.32 * swell, (T * 0.24 + b * 0.5) * swell, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(x - T * 0.12, y - b, T * 0.06, T * 0.08);
  ctx.fillRect(x + T * 0.06, y - b, T * 0.06, T * 0.08);
  if (stunned) { // circling stars
    ctx.fillStyle = '#ff6';
    for (let i = 0; i < 3; i++) {
      const a = now() / 200 + (i * Math.PI * 2) / 3;
      ctx.fillRect(x + Math.cos(a) * T * 0.3 - 2, y - T * 0.35 + Math.sin(a) * T * 0.1 - 2, 4, 4);
    }
  }
});

registerDrawer('campfire', (ctx, e, x, y, T) => {
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(x - T * 0.3, y + T * 0.12, T * 0.6, T * 0.1);
  ctx.fillRect(x - T * 0.05, y + T * 0.0, T * 0.1, T * 0.3);
  if (e.fuel > 0) {
    const size = 0.5 + 0.5 * Math.min(1, e.fuel / 30);
    const f = Math.sin(now() / 70 + e.id) * T * 0.05;
    ctx.fillStyle = '#f80';
    ctx.beginPath(); ctx.ellipse(x, y - T * 0.02, T * 0.18 * size, (T * 0.26 + f) * size, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fd4';
    ctx.beginPath(); ctx.ellipse(x, y + T * 0.04, T * 0.08 * size, (T * 0.14 + f * 0.5) * size, 0, 0, Math.PI * 2); ctx.fill();
  } else { // embers
    ctx.fillStyle = Math.sin(now() / 400 + e.id) > 0 ? '#a33' : '#822';
    ctx.fillRect(x - T * 0.15, y + T * 0.08, T * 0.3, T * 0.06);
  }
  // fuel bar
  const frac = Math.max(0, Math.min(1, e.fuel / e.maxFuel));
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - T * 0.4, y - T * 0.6, T * 0.8, 5);
  ctx.fillStyle = frac > 0.33 ? '#fa3' : '#e33';
  ctx.fillRect(x - T * 0.4, y - T * 0.6, T * 0.8 * frac, 5);
});

// -------------------------------------------- short-lived effects (sparks) ----

const effects = [];
function spark(x, y, color, ms = 250) { effects.push({ x, y, color, until: now() + ms, ms }); }

registerHud('effects', (ctx, game) => {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i], left = fx.until - now();
    if (left <= 0) { effects.splice(i, 1); continue; }
    const p = game.worldToScreen(fx.x, fx.y), r = 6 + 18 * (1 - left / fx.ms);
    ctx.strokeStyle = fx.color;
    ctx.globalAlpha = left / fx.ms;
    ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * r * 0.4, p.y + Math.sin(a) * r * 0.4);
      ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      ctx.stroke();
    }
  }
});

// ---------------------------------------------------------------- sound ----

let audio = null;
const unlockAudio = () => { // browsers only allow audio after a user gesture
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (AC) audio ||= new AC();
};
addEventListener('keydown', unlockAudio, { once: true });
addEventListener('mousedown', unlockAudio, { once: true });

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
  if (e) e._flashUntil = now() + 120;
  blip(id === game.myId ? 120 : 220, 0.12, 'square', 0.08, 60);
});
onEvent('net:swing', (game, { id }) => {
  const e = game.entities.get(id);
  if (e) e._swingUntil = now() + 150;
  if (id === game.myId) blip(600, 0.06, 'triangle', 0.05, 300);
});
onEvent('net:parry', (game, { x, y }) => { spark(x, y, '#ffe680', 300); blip(1400, 0.15, 'triangle', 0.1, 900); });
onEvent('net:block', (game, { x, y }) => { spark(x, y, '#d9b26f', 200); blip(180, 0.1, 'square', 0.08, 120); });
onEvent('net:harvested', (game, { by }) => { if (by === game.myId) blip(300, 0.08, 'square', 0.06, 180); });
onEvent('net:fed', (game, { id }) => {
  const e = game.entities.get(id);
  if (e) spark(e.x, e.y - 0.2, '#fa3', 300);
  blip(250, 0.3, 'sawtooth', 0.04, 500);
});
onEvent('net:fireOut', () => blip(160, 0.6, 'sine', 0.08, 60));
onEvent('net:crafted', () => blip(500, 0.25, 'triangle', 0.07, 900));
onEvent('net:dusk', () => blip(110, 1.5, 'sine', 0.12, 55));
onEvent('net:dawn', () => blip(330, 1.0, 'sine', 0.08, 660));
onEvent('net:died', () => blip(200, 0.8, 'sawtooth', 0.08, 40));
