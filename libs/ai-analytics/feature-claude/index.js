/**
 * AI Analytics Feature Claude - Library Exports
 * DDD/NX Architecture Export Index
 */

// Export Hybrid AI Service
const HybridAIService = require('./src/lib/hybrid-ai-service');

// Export all Claude-related services
module.exports = {
  HybridAIService,
  
  // Re-export with legacy name for compatibility
  hybridAIService: HybridAIService
};