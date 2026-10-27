// Global constants shared by server and client. Owned by: Integration.

export const WORLD_W = 160;        // world width in tiles
export const WORLD_H = 160;        // world height in tiles
export const TILE_PX = 32;         // on-screen size of one tile in pixels
export const TICK_HZ = 20;         // server simulation and snapshot rate
export const DAY_LENGTH = 240;     // seconds for one full day/night cycle

// Fields on an entity whose names start with this prefix stay on the side
// that created them: the server never sends them, and the client never
// receives them. Use them for AI state, cooldowns, interpolation, etc.
export const PRIVATE_PREFIX = '_';
