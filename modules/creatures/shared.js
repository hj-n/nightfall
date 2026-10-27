// TEAM CREATURES: monsters, animals, villagers/NPCs, quests.
import { registerEntityType, registerKeyHint } from '../../shared/registry.js';

registerEntityType('slime', { hp: 3, color: '#5c5', speed: 1.6, damage: 1, hostile: true, windup: false, aggro: 8, threat: 1 });
// hostile + hp: counted by the game director; threat: how much of its budget one costs.

// TODO(creatures team): animals that drop food, villagers that hand out
// procedural quests ("bring 5 wood"), a raid on every third night.

registerKeyHint('F3', 'director debug');
