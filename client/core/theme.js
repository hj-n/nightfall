// Halloween art direction: fonts and colors. Owned by: Integration (Art may tune values).
// Use game.font(px) / game.font(px, 'display') and game.theme.colors.* in HUDs and drawers
// so the whole game reads as one look. Fonts come from Google Fonts (client/index.html);
// the fallbacks keep the game playable offline.

export const THEME = {
  font: {
    display: "'Creepster', 'Chiller', fantasy",           // big notices, titles
    ui: "'Grenze', 'Trebuchet MS', system-ui, sans-serif", // HUD text, labels, menus
  },
  colors: {
    pumpkin: '#ff7a1a',  // primary accent: selection, highlights
    ember: '#ffb347',
    candle: '#ffe08a',   // glowing faces, bright text
    bone: '#efe6d2',     // default text
    ash: '#9a90a8',      // muted text, disabled
    purple: '#7a3fb0',   // secondary accent: borders, fills
    moon: '#c3a6f0',     // night text (readable lavender)
    violet: '#2a1640',   // panels
    toxic: '#8fdc4a',    // slimes, poison
    blood: '#c0262f',    // damage, health
    night: '#0b0614',    // background
    panel: 'rgba(20, 8, 32, 0.78)',
  },
  nightTint: [16, 6, 30], // rgb of the darkness overlay at night
  fog: [8, 4, 16],        // rgb of the fog of war
  glow: '#ff8a2a',        // default tint around lights (entities may set lightColor)
};

/** CSS font string, e.g. font(14) or font(32, 'display') */
export const font = (px, kind = 'ui') => `${px}px ${THEME.font[kind] || THEME.font.ui}`;
