const fs = require('fs');
const path = require('path');

// Simple file logger with size limit (dev mode - single file)
class SimpleLogger {
  constructor() {
    this.logFile = path.join(__dirname, '..', 'logs', 'server.log');
    this.errorFile = path.join(__dirname, '..', 'logs', 'server-errors.log');
    this.maxSize = 100 * 1024 * 1024; // 100MB max size - then truncate

    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Clear old logs on startup
    this.clearLogs();
  }

  clearLogs() {
    try {
      fs.writeFileSync(this.logFile, `===== Server Started: ${new Date().toISOString()} =====\n`);
      fs.writeFileSync(this.errorFile, `===== Server Started: ${new Date().toISOString()} =====\n`);
    } catch (err) {
      // Ignore errors
    }
  }

  checkAndRotate(file) {
    try {
      const stats = fs.statSync(file);
      if (stats.size > this.maxSize) {
        // Truncate to keep only last 10MB
        const fd = fs.openSync(file, 'r+');
        const keepSize = 10 * 1024 * 1024; // Keep last 10MB
        const buffer = Buffer.alloc(keepSize);
        fs.readSync(fd, buffer, 0, keepSize, stats.size - keepSize);
        fs.ftruncateSync(fd, 0);
        fs.writeSync(fd, `===== Log rotated: ${new Date().toISOString()} (was ${Math.round(stats.size/1024/1024)}MB) =====\n`);
        fs.writeSync(fd, buffer);
        fs.closeSync(fd);
      }
    } catch (err) {
      // Ignore rotation errors
    }
  }

  log(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const logLine = `[${timestamp}] ${message}\n`;

    // Check size before writing
    this.checkAndRotate(this.logFile);

    // Write to file
    fs.appendFileSync(this.logFile, logLine);
  }

  error(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const logLine = `[${timestamp}] ERROR: ${message}\n`;

    // Check size before writing
    this.checkAndRotate(this.logFile);
    this.checkAndRotate(this.errorFile);

    // Write to both files
    fs.appendFileSync(this.logFile, logLine);
    fs.appendFileSync(this.errorFile, logLine);
  }
  
  // Intercept console.log and console.error
  interceptConsole() {
    const originalLog = console.log;
    const originalError = console.error;
    const self = this;
    
    console.log = function(...args) {
      // Write to file
      self.log(...args);
      // Also output to original console
      originalLog.apply(console, args);
    };
    
    console.error = function(...args) {
      // Write to file  
      self.error(...args);
      // Also output to original console
      originalError.apply(console, args);
    };
    
    // Return function to restore original console
    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }
}

// Create singleton instance
const logger = new SimpleLogger();

module.exports = logger;