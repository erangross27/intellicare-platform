// Cache Cleanup Utility
// Runs periodic cleanup of expired cache entries for Gemini medical service

const cacheService = require('../services/geminiCacheService');

// Run cleanup every 15 minutes
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

// Start cleanup job
function startCacheCleanup() {
  // Starting cache cleanup job
  
  // Run initial cleanup
  performCleanup();
  
  // Schedule periodic cleanup
  setInterval(() => {
    performCleanup();
  }, CLEANUP_INTERVAL);
}

// Perform cleanup and log results
function performCleanup() {
  try {
    const clearedCount = cacheService.clearExpired();
    const stats = cacheService.getStats();
    
    // Cache cleanup completed
    // Cache statistics: hits and misses tracked
  } catch (error) {
    console.error('❌ Cache cleanup error:', error.message);
  }
}

// Export functions
module.exports = {
  startCacheCleanup,
  performCleanup
};

// Auto-start if running directly
if (require.main === module) {
  startCacheCleanup();
  // Cache cleanup utility running standalone
}