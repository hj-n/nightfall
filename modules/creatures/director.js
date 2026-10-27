// TEAM CREATURES (server helper): the game director.
//
// Inspired by the pacing directors in Left 4 Dead and Darktide: instead of a
// fixed spawn rate, the director keeps a THREAT BUDGET that scales with how
// strong the group is, and cycles through three moods so nights have shape:
//
//   build-up  monsters trickle in until the live threat reaches the budget
//   peak      the players are under pressure (or a horde just hit): hold it
//   relax     no new spawns; let people breathe, feed fires, regroup
//
// Budget = base (2)
//        × players^0.8                  more people, more monsters (sublinear)
//        × (1 + 0.35 × average gear)    shields etc. (item.gear, or 1 per `equip` item)
//        × (1 + 0.08 × settlement)      burning fires + structure tiles / 10
//        × (1 + 0.25 × (night - 1))     every night is harder than the last
//        × ramp(night progress)         quiet at dusk, worst around midnight
//        capped at maxBudget (40)
//
// Intensity (0..1) per player rises when they take damage or have monsters
// close, and decays over time. The group's intensity is the highest one.
//
// All state lives on game.director, so it survives hot swaps.
import { registries } from '../../shared/registry.js';

export const TUNING = {
  base: 2,
  playerExponent: 0.8,
  perGear: 0.35,
  perSettlement: 0.08,
  maxBudget: 40,          // hard cap on live threat, for fun and for the server
  perNight: 0.25,
  spawnInterval: 0.7,     // seconds between spawns during build-up
  peakIntensity: 0.7,     // group intensity that tips build-up into peak
  peakSeconds: 15,
  relaxSeconds: 20,
  hordeShare: 0.8,        // horde size as a fraction of the budget
  damageIntensity: 0.15,  // per point of damage taken
  closeIntensity: 0.06,   // per second per monster within 3 tiles
  intensityDecay: 0.08,   // per second
};

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

export function director(game) {
  return (game.director ||= { state: 'idle', since: game.time, budget: 0, threat: 0, intensity: 0, hordes: [], nextSpawn: 0, factors: {} });
}

const isHostile = (e) => e.hostile && e.hp > 0;
const threatOf = (e) => registries.entityTypes.get(e.type)?.defaults?.threat ?? 1;

function gearScore(players) {
  if (!players.length) return 0;
  let total = 0;
  for (const p of players) {
    for (const [name, n] of Object.entries(p.inventory || {})) {
      const item = registries.items.get(name);
      if (n > 0 && item) total += item.gear ?? (item.equip ? 1 : 0);
    }
  }
  return total / players.length;
}

function settlementScore(game, d) {
  if (game.time - (d._settlementAt || -99) > 2) { // structures are expensive to count; refresh every 2 s
    let structures = 0;
    for (const id of game.world.edits.values()) if (registries.tiles[id]?.structure) structures++;
    d._structures = structures;
    d._settlementAt = game.time;
  }
  const fires = [...game.entities.values()].filter((e) => e.repels).length;
  return fires + d._structures / 10;
}

export function computeBudget(game, tod = game.timeOfDay()) {
  const players = game.players();
  const f = {
    players: players.length,
    gear: gearScore(players),
    settlement: settlementScore(game, director(game)),
    night: tod.day,
    ramp: 0.6 + 0.7 * Math.sin(Math.PI * tod.nightProgress),
  };
  const T = TUNING;
  const budget = T.base * Math.pow(f.players, T.playerExponent) * (1 + T.perGear * f.gear) *
    (1 + T.perSettlement * f.settlement) * (1 + T.perNight * (f.night - 1)) * f.ramp;
  return { budget: players.length ? Math.min(T.maxBudget, budget) : 0, factors: f };
}

/** Call from an onEvent('damage') listener. */
export function noteDamage(game, hit) {
  if (hit.cancelled || hit.target.type !== 'player') return;
  hit.target._intensity = Math.min(1, (hit.target._intensity || 0) + hit.amount * TUNING.damageIntensity);
}

/** Call at dusk: plan tonight's hordes (fractions of the night). */
export function planNight(game, tod) {
  const d = director(game);
  d.hordes = tod.day >= 3 ? [0.35, 0.75] : [0.5];
  setState(game, 'build-up');
}

function setState(game, state) {
  const d = director(game);
  if (d.state !== state) { d.state = state; d.since = game.time; }
}

/** Call every tick. spawnFn(game, player, { horde, angle }) must spawn one monster or return null. */
export function updateDirector(game, dt, spawnFn) {
  const d = director(game);
  const tod = game.timeOfDay();
  const players = game.players();

  // intensity bookkeeping (also during the day, so it decays)
  const hostiles = [...game.entities.values()].filter(isHostile);
  d.intensity = 0;
  for (const p of players) {
    const close = hostiles.filter((h) => Math.hypot(h.x - p.x, h.y - p.y) < 3).length;
    p._intensity = Math.max(0, Math.min(1, (p._intensity || 0) + (close * TUNING.closeIntensity - TUNING.intensityDecay) * dt));
    d.intensity = Math.max(d.intensity, p._intensity);
  }

  if (!tod.isNight || !players.length) { setState(game, 'idle'); d.budget = 0; return; }
  if (d.state === 'idle') planNight(game, tod);

  const { budget, factors } = computeBudget(game, tod);
  d.budget = budget;
  d.factors = factors;
  d.threat = hostiles.reduce((sum, h) => sum + threatOf(h), 0);
  const inState = game.time - d.since;

  // hordes
  if (d.hordes.length && tod.nightProgress >= d.hordes[0]) {
    d.hordes.shift();
    const target = players.reduce((best, p) => (p._intensity || 0) < (best._intensity || 0) ? p : best); // the calmest player
    const angle = Math.random() * Math.PI * 2;
    const size = Math.max(3, Math.round(budget * TUNING.hordeShare));
    let n = 0;
    for (let i = 0; i < size; i++) if (spawnFn(game, target, { horde: true, angle })) n++;
    const from = COMPASS[Math.round(((angle % (2 * Math.PI)) / (Math.PI / 4))) % 8];
    game.broadcast('horde', { from, count: n, target: target.id });
    setState(game, 'peak');
    return;
  }

  switch (d.state) {
    case 'build-up':
      if (d.intensity >= TUNING.peakIntensity) { setState(game, 'peak'); break; }
      if (d.threat < budget && game.time >= d.nextSpawn) {
        d.nextSpawn = game.time + TUNING.spawnInterval;
        spawnFn(game, players[Math.floor(Math.random() * players.length)], { horde: false });
      }
      break;
    case 'peak':
      if (d.threat < budget && game.time >= d.nextSpawn) {
        d.nextSpawn = game.time + TUNING.spawnInterval;
        spawnFn(game, players[Math.floor(Math.random() * players.length)], { horde: false });
      }
      if (inState > TUNING.peakSeconds) setState(game, 'relax');
      break;
    case 'relax':
      if (inState > TUNING.relaxSeconds && d.intensity < 0.3) setState(game, 'build-up');
      break;
  }
}
