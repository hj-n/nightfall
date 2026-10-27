// The registries: the ONLY way teams add content and behavior.
// Each team calls these from its own modules/<team>/ files. Owned by: Integration.
//
// Where to call what:
//   shared.js  registerTile, registerItem, registerRecipe, registerEntityType,
//              registerSpell, registerWorldPass, registerKeyHint
//   server.js  registerSystem, onAction, onEvent
//   client.js  registerClientSystem, registerDrawer, registerHud, registerSetting, onEvent
//
// Tiles get numeric ids in registration order. Server and clients load
// shared.js files in the same order, so ids match. Never register tiles
// conditionally or from server.js / client.js.

export const registries = {
  tiles: [],                 // index = tile id
  tileByName: new Map(),
  items: new Map(),
  recipes: new Map(),
  entityTypes: new Map(),
  spells: new Map(),
  worldPasses: [],
  keyHints: [],
  listeners: [],             // onEvent registrations for this side
  // server only
  systems: [],
  actions: new Map(),        // action name -> [handler]
  // client only
  clientSystems: [],
  drawers: new Map(),        // entity type or 'tile:<name>' -> draw function
  huds: [],
  settings: [],              // { key, label, options, default, names }, shown in the Esc panel
};

let currentModule = 'core';
export function _setCurrentModule(name) { currentModule = name; }

function put(map, kind, name, value) {
  if (map.has(name)) console.warn(`[registry] ${kind} "${name}" registered twice (now by ${currentModule})`);
  map.set(name, { ...value, name, module: currentModule });
}

// ---------- shared.js ----------

/** def: { color, solid, opaque, structure, interact,
 *         harvest: { item, count, becomes },   mined by holding left click
 *         hardness: seconds to mine by hand (default 1), tool: 'axe' | 'pickaxe' (that tool mines faster),
 *         ...anything } */
export function registerTile(name, def = {}) {
  if (registries.tileByName.has(name)) throw new Error(`Tile "${name}" registered twice`);
  const tile = { color: '#ff00ff', solid: false, ...def, id: registries.tiles.length, name, module: currentModule };
  registries.tiles.push(tile);
  registries.tileByName.set(name, tile);
  return tile;
}

export function tileId(name) {
  const t = registries.tileByName.get(name);
  if (!t) throw new Error(`Unknown tile "${name}"`);
  return t.id;
}

/** def: { color, equip: 'offhand'|..., gear: number (director gear score),
 *         damage: melee damage while held, tool: 'axe'|'pickaxe', power: mining speed factor,
 *         places: entity type | placesTile: tile name (right click places it), use: true (right click sends 'use'),
 *         ...anything } */
export function registerItem(name, def = {}) { put(registries.items, 'item', name, def); }

/** def: { inputs: { wood: 5 }, output: { item: count } | undefined, places: entityType | undefined } */
export function registerRecipe(name, def) { put(registries.recipes, 'recipe', name, def); }

/** defaults: plain data only (no functions); copied onto every spawned entity */
export function registerEntityType(type, defaults = {}) { put(registries.entityTypes, 'entity type', type, { defaults }); }

/** def: { cost, cooldown, ...anything } */
export function registerSpell(name, def = {}) { put(registries.spells, 'spell', name, def); }

/** fn(world, rng) runs once at world generation, sorted by order (low first). Use only rng / world.seed. */
export function registerWorldPass(name, fn, { order = 100 } = {}) {
  registries.worldPasses.push({ name, fn, order, module: currentModule });
}

/** Shown in the on-screen help line, e.g. registerKeyHint('E', 'interact') */
export function registerKeyHint(key, label) { registries.keyHints.push({ key, label }); }

// ---------- server.js ----------

// ---------- server.js or client.js ----------

/** fn(game, ...args) runs whenever game.bus emits `name` on this side.
 *  Client side: server broadcasts arrive as 'net:<name>' (e.g. 'net:hit'). */
export function onEvent(name, fn) { registries.listeners.push({ event: name, name: `${currentModule}/on:${name}`, fn }); }

/** Called by server/client startup to attach onEvent listeners to the bus. */
export function _attachListeners(game) {
  for (const l of registries.listeners) game.bus.on(l.event, (...args) => l.fn(game, ...args));
}

// ---------- server.js ----------

/** fn(game, dt) runs every server tick */
export function registerSystem(name, fn) { registries.systems.push({ name: `${currentModule}/${name}`, fn }); }

/** fn(game, player, data) runs when a client calls game.sendAction(name, data) */
export function onAction(name, fn) {
  if (!registries.actions.has(name)) registries.actions.set(name, []);
  registries.actions.get(name).push({ name: `${currentModule}/action:${name}`, fn });
}

// ---------- client.js ----------

/** fn(game, dt) runs every animation frame in the browser */
export function registerClientSystem(name, fn) { registries.clientSystems.push({ name: `${currentModule}/${name}`, fn }); }

/** key: entity type, 'tile:<tileName>', or 'item:<itemName>'.
 *  entity drawer: fn(ctx, e, sx, sy, size, game)   (sx, sy = screen center)
 *  tile drawer:   fn(ctx, tile, px, py, size, tx, ty, game)  (px, py = top-left)
 *  item icon:     fn(ctx, item, cx, cy, size, game)  (hotbar and inventory; cx, cy = center) */
export function registerDrawer(key, fn) { registries.drawers.set(key, fn); }

/** fn(ctx, game, width, height) draws in screen space after the world */
export function registerHud(name, fn) { registries.huds.push({ name: `${currentModule}/${name}`, fn }); }

/** A row in the Esc settings panel. def: { label, options: [values], default, names: { value: label } }.
 *  Stored per browser; read it with game.settings[key]. */
export function registerSetting(key, def) { registries.settings.push({ ...def, key, module: currentModule }); }
