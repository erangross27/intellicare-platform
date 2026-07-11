// Cache Performance Monitoring API Routes
const express = require('express');
const router = express.Router();
const cacheMonitor = require('../services/claudeCacheMonitor');
const { auth } = require('../middleware/auth');

// Get performance metrics
router.get('/metrics', auth, (req, res) => {
  try {
    const metrics = cacheMonitor.getPerformanceMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session-specific metrics
router.get('/session/:sessionId', auth, (req, res) => {
  try {
    const metrics = cacheMonitor.getSessionMetrics(req.params.sessionId);
    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error fetching session metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get hourly breakdown
router.get('/hourly', auth, (req, res) => {
  try {
    const breakdown = cacheMonitor.getHourlyBreakdown();
    res.json({
      success: true,
      breakdown
    });
  } catch (error) {
    console.error('Error fetching hourly breakdown:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get daily breakdown
router.get('/daily', auth, (req, res) => {
  try {
    const breakdown = cacheMonitor.getDailyBreakdown();
    res.json({
      success: true,
      breakdown
    });
  } catch (error) {
    console.error('Error fetching daily breakdown:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate performance report
router.get('/report', auth, (req, res) => {
  try {
    const report = cacheMonitor.generateReport();
    res.type('text/plain').send(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset metrics (admin only)
router.post('/reset', auth, (req, res) => {
  try {
    // Check if user is admin (you may want to add proper admin check)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    cacheMonitor.resetMetrics();
    res.json({
      success: true,
      message: 'Metrics reset successfully'
    });
  } catch (error) {
    console.error('Error resetting metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

/* API Endpoints:

GET /api/cache-monitor/metrics - Get overall performance metrics
GET /api/cache-monitor/session/:sessionId - Get metrics for specific session
GET /api/cache-monitor/hourly - Get hourly breakdown
GET /api/cache-monitor/daily - Get daily breakdown
GET /api/cache-monitor/report - Get text performance report
POST /api/cache-monitor/reset - Reset all metrics (admin only)

*/