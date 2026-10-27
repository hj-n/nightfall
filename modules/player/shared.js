// TEAM PLAYER: movement, combat, magic, health, death.
import { registerEntityType, registerKeyHint } from '../../shared/registry.js';

registerEntityType('player', { hp: 10, maxHp: 10, light: 3.5, speed: 5 });

registerKeyHint('WASD', 'move');
registerKeyHint('Space', 'attack');

// TODO(player team): spells, e.g.
// registerSpell('firebolt', { cost: 2, cooldown: 1 });
