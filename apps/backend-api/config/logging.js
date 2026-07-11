// Logging configuration for IntelliCare
// Controls verbosity of different log categories

const secureConfigService = require('../services/secureConfigService');

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  VERBOSE: 4
};

// Set the global log level based on environment
const getLogLevel = () => {
  const logLevel = secureConfigService.get('LOG_LEVEL');
  if (logLevel) {
    return LOG_LEVELS[logLevel.toUpperCase()] || LOG_LEVELS.INFO;
  }
  
  // Default log levels per environment
  const nodeEnv = secureConfigService.get('NODE_ENV', 'development');
  if (nodeEnv === 'production') {
    return LOG_LEVELS.WARN;
  } else if (nodeEnv === 'test') {
    return LOG_LEVELS.ERROR;
  } else {
    return LOG_LEVELS.INFO;
  }
};

// Category-specific log settings
const getCategorySettings = () => {
  const quietLogs = secureConfigService.get('QUIET_LOGS') === 'true';
  return {
    // Quiet these during testing
    'patient-schema': quietLogs ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG,
    'chat-sessions': quietLogs ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG,
    'batch-jobs': quietLogs ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG,
    'practice-context': quietLogs ? LOG_LEVELS.ERROR : LOG_LEVELS.INFO,
    'hipaa-functions': quietLogs ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG,
    'agent-service': quietLogs ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG,
  
    // Keep these visible even in quiet mode
    'security': LOG_LEVELS.WARN,
    'error': LOG_LEVELS.ERROR,
    'audit': LOG_LEVELS.INFO
  };
};

const categorySettings = getCategorySettings();

class Logger {
  constructor(category = 'general') {
    this.category = category;
    this.level = categorySettings[category] || getLogLevel();
  }
  
  shouldLog(level) {
    return level <= this.level;
  }
  
  error(...args) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[${this.category}]`, ...args);
    }
  }
  
  warn(...args) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[${this.category}]`, ...args);
    }
  }
  
  info(...args) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[${this.category}]`, ...args);
    }
  }
  
  debug(...args) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[${this.category}]`, ...args);
    }
  }
  
  verbose(...args) {
    if (this.shouldLog(LOG_LEVELS.VERBOSE)) {
      console.log(`[${this.category}]`, ...args);
    }
  }
}

// Export a function to create loggers for different categories
const createLogger = (category) => new Logger(category);

// Export a simple function to conditionally log based on QUIET_LOGS env var
const conditionalLog = (message, ...args) => {
  if (SecureConfigService.get("QUIET_LOGS") !== 'true') {
    console.log(message, ...args);
  }
};

// Export debug log that only shows in development
const debugLog = (message, ...args) => {
  if (SecureConfigService.get("NODE_ENV") !== 'production' && SecureConfigService.get("QUIET_LOGS") !== 'true') {
    console.log(message, ...args);
  }
};

module.exports = {
  Logger,
  createLogger,
  conditionalLog,
  debugLog,
  LOG_LEVELS
};