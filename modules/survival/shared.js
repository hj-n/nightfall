// TEAM SURVIVAL: items, equipment, crafting, building, hunger.
import { registerItem, registerRecipe, registerEntityType, registerKeyHint } from '../../shared/registry.js';

registerItem('wood',  { color: '#8b5a2b' });
registerItem('stone', { color: '#999' });

// A recipe either gives items (output) or places an entity in front of the player (places).
registerRecipe('campfire', { inputs: { wood: 5 }, places: 'campfire' });

registerEntityType('campfire', { light: 6, color: '#f80' });

registerKeyHint('E', 'harvest');
registerKeyHint('C', 'campfire (5 wood)');

// TODO(survival team): hunger, food, walls and doors (as tiles), tools that
// harvest faster, a crafting menu, equipment slots.
