let _counter = 0;

/**
 * Generates a unique player ID using timestamp + incrementing counter.
 * Ensures uniqueness even if called multiple times within the same millisecond.
 */
export function generatePlayerId() {
  _counter = (_counter + 1) % 10000;
  return `player_${Date.now()}_${_counter}`;
}
