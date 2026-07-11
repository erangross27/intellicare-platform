/**
 * Patient Management Feature Portal - Library Exports
 * DDD/NX Architecture Export Index
 */

// Export Health Campaign Service
const HealthCampaignService = require('./src/lib/health-campaign-service');

// Export all portal-related services
module.exports = {
  HealthCampaignService,
  
  // Re-export with legacy name for compatibility
  healthCampaignService: new HealthCampaignService()
};