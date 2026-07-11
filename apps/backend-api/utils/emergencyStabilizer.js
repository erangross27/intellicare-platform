/**
 * Emergency System Stabilizer
 * Prevents unhandled rejections from crashing the server
 * Provides graceful error handling during development
 */

const secureConfigService = require('../services/secureConfigService');

class EmergencyStabilizer {
  static init() {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Emergency Stabilizer caught unhandled rejection:', reason?.message || reason);
      console.error('Promise:', promise);
      
      // Log stack trace if available
      if (reason?.stack) {
        console.error('Stack trace:', reason.stack);
      }
      
      // Don't exit - just log and continue
      // In production, you might want different behavior
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('🚨 Emergency Stabilizer caught uncaught exception:', error.message);
      console.error('Stack trace:', error.stack);
      
      // In development, we continue running
      // In production, you might want to exit gracefully
      if (secureConfigService.get('NODE_ENV') === 'production') {
        console.error('💀 Critical error in production - initiating graceful shutdown');
        process.exit(1);
      }
    });
    
    // Emergency Stabilizer activated
  }
}

module.exports = EmergencyStabilizer;