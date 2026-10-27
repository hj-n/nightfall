// TEAM SURVIVAL: items, equipment, crafting, building, hunger, fire.
import { registerItem, registerRecipe, registerEntityType, registerKeyHint } from '../../shared/registry.js';

registerItem('wood',   { color: '#8b5a2b' });
registerItem('stone',  { color: '#999' });
registerItem('shield', { color: '#a0703a', equip: 'offhand' });

// A recipe either gives items (output) or places an entity in front of the player (places).
registerRecipe('campfire', { inputs: { wood: 5 }, places: 'campfire' });
registerRecipe('shield',   { inputs: { wood: 3, stone: 2 }, output: { shield: 1 } });

// fuel is in seconds of burn time. A burning fire (repels: true) keeps monsters
// out of its light; its light shrinks as the fuel runs low.
registerEntityType('campfire', { fuel: 45, maxFuel: 90, light: 6, repels: true, color: '#f80' });

registerKeyHint('E', 'harvest/feed fire');
registerKeyHint('C', 'campfire (5 wood)');
registerKeyHint('V', 'shield (3 wood 2 stone)');

// TODO(survival team): hunger and food, walls and doors (as tiles), tools
// that harvest faster, a crafting menu, chests.
