/**
 * File-based logging system for backend
 * Writes logs to files that can be tailed easily
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

class FileLogger {
  constructor() {
    // Create logs directory if it doesn't exist
    this.logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Different log files for different purposes
    this.logFiles = {
      general: path.join(this.logsDir, 'app.log'),
      documentProcessing: path.join(this.logsDir, 'document-processing.log'),
      patientMatching: path.join(this.logsDir, 'patient-matching.log'),
      dataStorage: path.join(this.logsDir, 'data-storage.log'),
      errors: path.join(this.logsDir, 'errors.log')
    };
    
    // Create initial log files if they don't exist
    Object.values(this.logFiles).forEach(file => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, `=== Log started at ${new Date().toISOString()} ===\n`);
      }
    });
  }
  
  // Get local timestamp with timezone
  getLocalTimestamp() {
    const now = new Date();
    // Format: YYYY-MM-DDTHH:mm:ss.sss+HH:mm (ISO 8601 with local timezone)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    // Get timezone offset in format +HH:mm or -HH:mm
    const tzOffset = -now.getTimezoneOffset();
    const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
    const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
    const tzSign = tzOffset >= 0 ? '+' : '-';
    const timezone = `${tzSign}${tzHours}:${tzMinutes}`;

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${timezone}`;
  }

  // Format log message with timestamp and level
  formatMessage(level, message, data) {
    const timestamp = this.getLocalTimestamp();
    let logLine = `[${timestamp}] [${level}] ${message}`;

    if (data) {
      // Pretty print objects
      const dataStr = typeof data === 'object'
        ? '\n' + util.inspect(data, { depth: 3, colors: false })
        : ' ' + data;
      logLine += dataStr;
    }

    return logLine + '\n';
  }
  
  // Write to specific log file
  writeToFile(file, level, message, data) {
    const logLine = this.formatMessage(level, message, data);
    
    // Append to file
    fs.appendFileSync(file, logLine);
    
    // Also write errors to error log
    if (level === 'ERROR' && file !== this.logFiles.errors) {
      fs.appendFileSync(this.logFiles.errors, logLine);
    }
    
    // Also log to console for immediate visibility
    if (level === 'ERROR') {
      console.error(`❌ ${message}`, data || '');
    } else if (level === 'WARN') {
      console.warn(`⚠️ ${message}`, data || '');
    } else if (level === 'SUCCESS') {
      console.log(`✅ ${message}`, data || '');
    } else {
      console.log(`📝 ${message}`, data || '');
    }
  }
  
  // General logging
  log(message, data) {
    this.writeToFile(this.logFiles.general, 'INFO', message, data);
  }
  
  info(message, data) {
    this.writeToFile(this.logFiles.general, 'INFO', message, data);
  }
  
  warn(message, data) {
    this.writeToFile(this.logFiles.general, 'WARN', message, data);
  }
  
  error(message, data) {
    this.writeToFile(this.logFiles.general, 'ERROR', message, data);
  }
  
  success(message, data) {
    this.writeToFile(this.logFiles.general, 'SUCCESS', message, data);
  }
  
  // Document processing specific logging
  documentProcessing(message, data) {
    this.writeToFile(this.logFiles.documentProcessing, 'INFO', message, data);
  }
  
  // Patient matching specific logging
  patientMatching(message, data) {
    this.writeToFile(this.logFiles.patientMatching, 'INFO', message, data);
  }
  
  // Data storage specific logging
  dataStorage(message, data) {
    this.writeToFile(this.logFiles.dataStorage, 'INFO', message, data);
  }
  
  // Get tail command for a specific log
  getTailCommand(logType = 'general') {
    const file = this.logFiles[logType] || this.logFiles.general;
    return `tail -f "${file}"`;
  }
  
  // List all available logs
  listLogs() {
    console.log('\n📁 Available log files:');
    Object.entries(this.logFiles).forEach(([name, path]) => {
      const size = fs.statSync(path).size;
      console.log(`  ${name}: ${path} (${(size / 1024).toFixed(2)} KB)`);
      console.log(`    Tail command: tail -f "${path}"`);
    });
  }
}

// Export singleton instance
module.exports = new FileLogger();