/**
 * MongoDB error classification helpers
 *
 * Local/dev MongoDB connections get briefly interrupted on Mac sleep/wake or
 * transient network blips. The driver clears the pool and surfaces errors like
 * `PoolClearedOnNetworkError` / `MongoNetworkTimeoutError` (labels: ResetPool,
 * InterruptInUseConnections, PoolRequestedRetry). These are recoverable — the
 * driver reconnects automatically — so periodic maintenance tasks should treat
 * them as expected noise (concise warning) rather than logging a full stack.
 *
 * Precedent: mongoChangeStreams.js already does this inline; this centralizes it.
 */

// Error class names the driver uses for recoverable pool/network conditions
const TRANSIENT_ERROR_NAMES = new Set([
  'PoolClearedOnNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNetworkError',
  'MongoServerSelectionError',
  'MongoNotConnectedError',
]);

// errorLabelSet labels attached to recoverable/retryable errors
const TRANSIENT_ERROR_LABELS = [
  'ResetPool',
  'InterruptInUseConnections',
  'PoolRequestedRetry',
  'RetryableWriteError',
];

// Message substrings that indicate a transient connection state
const TRANSIENT_MESSAGE_PATTERNS = [
  'interrupted due to server monitor timeout',
  'connection <monitor>',
  'timed out',
  'pool is closed',
  'client must be connected',
  'topology was destroyed',
  'econnrefused',
  'econnreset',
  'etimedout',
];

/**
 * Returns true if the error is a recoverable MongoDB connection/network blip
 * that the driver will retry/reconnect on its own.
 * @param {any} err
 * @returns {boolean}
 */
function isTransientMongoError(err) {
  if (!err) return false;

  // Walk the cause chain (driver nests the root MongoNetworkTimeoutError under [cause])
  let current = err;
  let depth = 0;
  while (current && depth < 5) {
    if (current.name && TRANSIENT_ERROR_NAMES.has(current.name)) return true;

    const labels = current.errorLabelSet;
    if (labels && typeof labels.has === 'function') {
      if (TRANSIENT_ERROR_LABELS.some((label) => labels.has(label))) return true;
    } else if (Array.isArray(current.errorLabels)) {
      if (TRANSIENT_ERROR_LABELS.some((label) => current.errorLabels.includes(label))) return true;
    }

    const msg = typeof current.message === 'string' ? current.message.toLowerCase() : '';
    if (msg && TRANSIENT_MESSAGE_PATTERNS.some((p) => msg.includes(p))) return true;

    current = current.cause;
    depth += 1;
  }

  return false;
}

module.exports = { isTransientMongoError };
