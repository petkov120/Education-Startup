const { randomUUID } = require("crypto");

/** @typedef {{ endsAtMs: number, durationSeconds: number, createdAtMs: number }} PracticeTimerRow */

/** @type {Map<string, PracticeTimerRow>} */
const practiceTimersById = new Map();

const MAX_STORE_AGE_MS = 24 * 60 * 60 * 1000;

function pruneExpiredEntries() {
  const now = Date.now();
  for (const [id, row] of practiceTimersById) {
    if (now - row.createdAtMs > MAX_STORE_AGE_MS) {
      practiceTimersById.delete(id);
    }
  }
}

/**
 * Registers a server-authoritative countdown window.
 * @param {number} durationSeconds
 * @returns {{ practiceTimerId: string, serverTimeIso: string, endsAtIso: string, durationSeconds: number }}
 */
function createPracticeTimer(durationSeconds) {
  pruneExpiredEntries();
  const practiceTimerId = randomUUID();
  const createdAtMs = Date.now();
  const endsAtMs = createdAtMs + durationSeconds * 1000;
  practiceTimersById.set(practiceTimerId, {
    endsAtMs,
    durationSeconds,
    createdAtMs,
  });
  return {
    practiceTimerId,
    serverTimeIso: new Date(createdAtMs).toISOString(),
    endsAtIso: new Date(endsAtMs).toISOString(),
    durationSeconds,
  };
}

/**
 * @param {string} practiceTimerId
 * @returns {{ practiceTimerId: string, serverTimeIso: string, endsAtIso: string, expired: boolean, remainingSeconds: number } | null}
 */
function getPracticeTimerStatus(practiceTimerId) {
  pruneExpiredEntries();
  const row = practiceTimersById.get(practiceTimerId);
  if (!row) return null;
  const now = Date.now();
  const remainingMs = row.endsAtMs - now;
  return {
    practiceTimerId,
    serverTimeIso: new Date(now).toISOString(),
    endsAtIso: new Date(row.endsAtMs).toISOString(),
    expired: remainingMs <= 0,
    remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
  };
}

module.exports = {
  createPracticeTimer,
  getPracticeTimerStatus,
};
