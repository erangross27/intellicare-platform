const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const ConnectionMetricsCollector = require('../services/connectionMetricsCollector');
    const health = ConnectionMetricsCollector.getHealthStatus();

    res.status(health.healthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message
    });
  }
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const ConnectionMetricsCollector = require('../services/connectionMetricsCollector');
    const ConnectionPoolManager = require('../services/connectionPoolManager');
    const ServiceRegistry = require('../services/serviceRegistry');

    res.json({
      pool: ConnectionPoolManager.getStatus(),
      metrics: ConnectionMetricsCollector.getMetrics(),
      services: ServiceRegistry.listServices().length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Performance dashboard
router.get('/performance', async (req, res) => {
  try {
    const PerformanceDashboard = require('../services/performanceDashboard');
    const report = await PerformanceDashboard.getFullReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;