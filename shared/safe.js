// Error isolation. Every team's code runs inside safely(), so one team's bug
// logs an error instead of crashing the server or freezing every client.
// Owned by: Integration.

const lastReport = new Map();

export function reportError(where, err) {
  const now = Date.now();
  if (now - (lastReport.get(where) || 0) < 5000) return; // at most once per 5 s per site
  lastReport.set(where, now);
  console.error(`[error in ${where}]`, err);
}

export function safely(where, fn, ...args) {
  try {
    return fn(...args);
  } catch (err) {
    reportError(where, err);
    return undefined;
  }
}
