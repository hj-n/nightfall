// Tiny event bus. Teams talk to each other through events instead of
// importing each other's code. Owned by: Integration.
import { safely } from './safe.js';

export function createBus() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
      return () => handlers.set(name, handlers.get(name).filter((f) => f !== fn));
    },
    emit(name, ...args) {
      for (const fn of handlers.get(name) || []) safely(`event "${name}"`, fn, ...args);
    },
  };
}
