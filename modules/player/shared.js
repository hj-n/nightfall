// TEAM PLAYER: movement, combat, magic, health, death.
import { registerEntityType, registerKeyHint } from '../../shared/registry.js';

// `light` is the torch every player carries: enough to see by, too weak to keep monsters away.
registerEntityType('player', { hp: 10, maxHp: 10, light: 2.5, speed: 5 });

registerKeyHint('WASD', 'move');
registerKeyHint('mouse', 'aim');
registerKeyHint('LMB/Space', 'swing');
registerKeyHint('RMB/Shift', 'guard');

// TODO(player team): spells, e.g.
// registerSpell('firebolt', { cost: 2, cooldown: 1 });
