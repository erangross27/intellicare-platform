/**
 * Centralized logging utility with verbosity control
 * Set VERBOSE_LOGS=true in .env to enable detailed debug logs
 */

const VERBOSE = process.env.VERBOSE_LOGS === 'true';

module.exports = {
  // Always log (errors, warnings, important info)
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),

  // Only log if VERBOSE_LOGS=true (debug info)
  verbose: (...args) => {
    if (VERBOSE) {
      console.log(...args);
    }
  },

  // Check if verbose mode is enabled
  isVerbose: () => VERBOSE
};
