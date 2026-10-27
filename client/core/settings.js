// Per-viewer settings and the Esc settings panel. Owned by: Integration.
// Settings live in game.settings and in this browser's localStorage (never on
// the server). Teams add rows with registerSetting() in their client.js and read
// the value with game.settings.<key>.
import { registries, registerSetting } from '../../shared/registry.js';

const STORE = 'nightfall.settings';

registerSetting('movement', {
  label: 'Movement', options: ['facing', 'screen'], default: 'facing',
  names: { facing: 'W walks toward the cursor', screen: 'W walks up the screen' },
});
registerSetting('showAim', { label: 'Aim indicator', options: [true, false], default: true, names: { true: 'shown', false: 'hidden' } });

function stored() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}

/** Fill game.settings from the defaults and this browser's saved values. Call after modules load. */
export function loadSettings(game) {
  const saved = stored();
  game.settings = {};
  for (const s of registries.settings) game.settings[s.key] = s.key in saved && s.options.includes(saved[s.key]) ? saved[s.key] : s.default;
}

export function saveSetting(game, key, value) {
  game.settings[key] = value;
  try { localStorage.setItem(STORE, JSON.stringify(game.settings)); } catch { /* private window: keep it for this session */ }
}

function layout(w, h) {
  const rows = registries.settings;
  const pw = Math.min(520, w - 32), ph = 90 + rows.length * 44;
  const x = (w - pw) / 2, y = Math.max(16, (h - ph) / 2);
  return { x, y, pw, ph, rows: rows.map((s, i) => ({ s, x: x + 16, y: y + 64 + i * 44, w: pw - 32, h: 38 })) };
}

const inside = (m, r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;

/** Esc opens and closes the panel (and closes any other open panel); clicks cycle values. */
export function updateSettings(game) {
  if (game.input.pressed('Escape')) game.ui = game.ui ? null : 'settings';
  if (game.ui !== 'settings' || !game.input.clicked(0)) return;
  for (const r of layout(game.screen.w, game.screen.h).rows) {
    if (!inside(game.input.mouse, r)) continue;
    const { key, options } = r.s;
    saveSetting(game, key, options[(options.indexOf(game.settings[key]) + 1) % options.length]);
  }
}

export function drawSettings(ctx, game, w, h) {
  if (game.ui !== 'settings') return;
  const { colors } = game.theme;
  const L = layout(w, h), m = game.input.mouse;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colors.panel;
  ctx.strokeStyle = colors.purple;
  ctx.lineWidth = 2;
  ctx.fillRect(L.x, L.y, L.pw, L.ph);
  ctx.strokeRect(L.x, L.y, L.pw, L.ph);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.pumpkin;
  ctx.font = game.font(34, 'display');
  ctx.fillText('Settings', L.x + L.pw / 2, L.y + 32);
  for (const r of L.rows) {
    const value = game.settings[r.s.key];
    if (inside(m, r)) { ctx.fillStyle = 'rgba(255,122,26,0.15)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    ctx.font = game.font(18);
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.bone;
    ctx.fillText(r.s.label, r.x + 10, r.y + r.h / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.candle;
    ctx.fillText(r.s.names?.[value] ?? String(value), r.x + r.w - 10, r.y + r.h / 2);
  }
  ctx.textAlign = 'center';
  ctx.font = game.font(14);
  ctx.fillStyle = colors.ash;
  ctx.fillText('click a row to change it  ·  Esc to close', L.x + L.pw / 2, L.y + L.ph - 16);
}
