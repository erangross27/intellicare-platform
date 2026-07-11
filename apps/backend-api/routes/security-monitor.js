const router = require('express').Router();
const securityMonitoringService = require('../services/securityMonitoringService');

// Real-time violations endpoint
router.get('/violations', async (req, res) => {
  const violations = await securityMonitoringService.getViolations();
  res.json(violations);
});

// Service health endpoint
router.get('/health', async (req, res) => {
  const health = await securityMonitoringService.getServiceHealth();
  res.json(health);
});

// WebSocket for live updates
router.ws('/live', (ws, req) => {
  securityMonitoringService.streamToClient(ws);
});

module.exports = router;