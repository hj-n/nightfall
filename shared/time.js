// Day/night clock. The server owns game time and sends it in every snapshot.
// Owned by: Integration.
import { DAY_LENGTH } from './config.js';

// The server sets clock.dayLength from the DAY_LENGTH env var and sends it to
// clients in the welcome message, so everyone agrees on the length of a day.
export const clock = { dayLength: DAY_LENGTH };

export const DUSK_START = 0.6, NIGHT_START = 0.7, DAWN_START = 0.95; // fractions of a day
const MAX_DARKNESS = 0.88;

// phase 0 is sunrise (06:00). Returns everything a system usually needs.
export function timeOfDay(time) {
  const L = clock.dayLength;
  const phase = (time % L) / L;
  let darkness = 0;
  if (phase >= DUSK_START && phase < NIGHT_START) darkness = (phase - DUSK_START) / (NIGHT_START - DUSK_START);
  else if (phase >= NIGHT_START && phase < DAWN_START) darkness = 1;
  else if (phase >= DAWN_START) darkness = 1 - (phase - DAWN_START) / (1 - DAWN_START);
  const isNight = phase >= NIGHT_START && phase < DAWN_START;
  const minutes = Math.floor((phase * 24 * 60 + 6 * 60) % (24 * 60));
  return {
    phase,
    darkness: darkness * MAX_DARKNESS,
    isNight,
    nightProgress: isNight ? (phase - NIGHT_START) / (DAWN_START - NIGHT_START) : 0, // 0 at nightfall, 1 at dawn
    nightLength: (DAWN_START - NIGHT_START) * L,                                      // seconds
    day: Math.floor(time / L) + 1,
    clock: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
  };
}
