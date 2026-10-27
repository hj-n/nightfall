// TEAM CREATURES: monsters, animals, villagers/NPCs, quests.
import { registerEntityType } from '../../shared/registry.js';

registerEntityType('slime', { hp: 3, color: '#5c5', speed: 1.6, damage: 1, hostile: true, windup: false });

// TODO(creatures team): animals that drop food, villagers that hand out
// procedural quests ("bring 5 wood"), a raid on every third night.
