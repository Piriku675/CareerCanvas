/**
 * utils/state.js
 * In-memory conversation state for multi-step flows.
 * Each admin user has one active "pending action" at a time.
 */

const states = new Map();

/**
 * Set the current pending action for a chat.
 * @param {number|string} chatId
 * @param {string} action   — e.g. "port_set_title", "cv_add_period"
 * @param {object} meta     — extra context (e.g. { itemId: "proj-01" })
 */
function setState(chatId, action, meta = {}) {
  states.set(String(chatId), { action, meta, ts: Date.now() });
}

/**
 * Get pending state for a chat (or null).
 */
function getState(chatId) {
  const s = states.get(String(chatId));
  if (!s) return null;
  // Auto-expire after 10 minutes
  if (Date.now() - s.ts > 10 * 60 * 1000) {
    states.delete(String(chatId));
    return null;
  }
  return s;
}

/**
 * Clear state for a chat.
 */
function clearState(chatId) {
  states.delete(String(chatId));
}

module.exports = { setState, getState, clearState };
