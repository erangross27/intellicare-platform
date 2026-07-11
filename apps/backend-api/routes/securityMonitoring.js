// Security Monitoring Routes
// Provides endpoints for real-time security monitoring

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const securityMonitoringService = require('../services/securityMonitoringService');
const { practiceAuth, fullClinicAuth } = require('../middleware/practiceAuth');

// @route   GET /api/security-monitoring/metrics
// @desc    Get current security metrics
// @access  Protected
router.get('/metrics', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const metrics = securityMonitoringService.getMetricsSummary();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metrics'
    });
  }
}));

// @route   GET /api/security-monitoring/detailed-metrics
// @desc    Get detailed security metrics (Admin)
// @access  Protected (Admin)
router.get('/detailed-metrics', fullClinicAuth, asyncHandler(async (req, res) => {
  try {
    const metrics = securityMonitoringService.getDetailedMetrics();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Detailed metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve detailed metrics'
    });
  }
}));

// @route   GET /api/security-monitoring/threat-report
// @desc    Generate threat report
// @access  Protected (Admin)
router.get('/threat-report', fullClinicAuth, asyncHandler(async (req, res) => {
  try {
    const report = securityMonitoringService.generateThreatReport();
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Threat report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate threat report'
    });
  }
}));

// @route   POST /api/security-monitoring/emit-event
// @desc    Emit security event (for testing)
// @access  Protected (Admin)
router.post('/emit-event', fullClinicAuth, asyncHandler(async (req, res) => {
  const { type, data, level } = req.body;
  
  if (!type || !data) {
    return res.status(400).json({
      success: false,
      message: 'Event type and data required'
    });
  }
  
  try {
    const event = securityMonitoringService.emitSecurityEvent(
      type,
      data,
      level || securityMonitoringService.alertLevels.INFO
    );
    
    res.json({
      success: true,
      message: 'Event emitted',
      event
    });
  } catch (error) {
    console.error('Event emission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to emit event'
    });
  }
}));

// @route   POST /api/security-monitoring/acknowledge-alert
// @desc    Acknowledge security alert
// @access  Protected
router.post('/acknowledge-alert', practiceAuth, asyncHandler(async (req, res) => {
  const { alertId } = req.body;
  
  if (!alertId) {
    return res.status(400).json({
      success: false,
      message: 'Alert ID required'
    });
  }
  
  try {
    const acknowledged = securityMonitoringService.acknowledgeAlert(
      alertId,
      req.user?._id?.toString() || 'unknown'
    );
    
    res.json({
      success: acknowledged,
      message: acknowledged 
        ? 'Alert acknowledged'
        : 'Alert not found'
    });
  } catch (error) {
    console.error('Alert acknowledgment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert'
    });
  }
}));

// @route   POST /api/security-monitoring/blacklist-ip
// @desc    Add IP to blacklist
// @access  Protected (Admin)
router.post('/blacklist-ip', fullClinicAuth, asyncHandler(async (req, res) => {
  const { ip, reason } = req.body;
  
  if (!ip || !reason) {
    return res.status(400).json({
      success: false,
      message: 'IP and reason required'
    });
  }
  
  try {
    securityMonitoringService.blacklistIP(ip, reason);
    
    res.json({
      success: true,
      message: `IP ${ip} blacklisted`
    });
  } catch (error) {
    console.error('IP blacklist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to blacklist IP'
    });
  }
}));

// @route   GET /api/security-monitoring/check-ip/:ip
// @desc    Check if IP is blacklisted
// @access  Protected
router.get('/check-ip/:ip', practiceAuth, asyncHandler(async (req, res) => {
  const { ip } = req.params;
  
  try {
    const isBlacklisted = securityMonitoringService.isIPBlacklisted(ip);
    
    res.json({
      success: true,
      ip,
      blacklisted: isBlacklisted
    });
  } catch (error) {
    console.error('IP check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check IP'
    });
  }
}));

// @route   GET /api/security-monitoring/active-alerts
// @desc    Get active security alerts
// @access  Protected
router.get('/active-alerts', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const alerts = securityMonitoringService.metrics.activeAlerts;
    
    res.json({
      success: true,
      count: alerts.length,
      alerts: alerts.slice(0, 50) // Limit to 50 most recent
    });
  } catch (error) {
    console.error('Active alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active alerts'
    });
  }
}));

// @route   GET /api/security-monitoring/system-health
// @desc    Get system health status
// @access  Protected
router.get('/system-health', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const health = securityMonitoringService.metrics.systemHealth;
    
    res.json({
      success: true,
      health
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system health'
    });
  }
}));

// @route   POST /api/security-monitoring/update-thresholds
// @desc    Update alert thresholds
// @access  Protected (Admin)
router.post('/update-thresholds', fullClinicAuth, asyncHandler(async (req, res) => {
  const { thresholds } = req.body;
  
  if (!thresholds || typeof thresholds !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Valid thresholds object required'
    });
  }
  
  try {
    // Update thresholds
    Object.assign(securityMonitoringService.alertThresholds, thresholds);
    
    res.json({
      success: true,
      message: 'Thresholds updated',
      thresholds: securityMonitoringService.alertThresholds
    });
  } catch (error) {
    console.error('Threshold update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update thresholds'
    });
  }
}));

// @route   GET /api/security-monitoring/event-types
// @desc    Get available event types
// @access  Protected
router.get('/event-types', practiceAuth, asyncHandler(async (req, res) => {
  try {
    res.json({
      success: true,
      eventTypes: securityMonitoringService.eventTypes,
      alertLevels: securityMonitoringService.alertLevels
    });
  } catch (error) {
    console.error('Event types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve event types'
    });
  }
}));

// @route   GET /api/security-monitoring/recent-events
// @desc    Get recent security events
// @access  Protected
router.get('/recent-events', practiceAuth, asyncHandler(async (req, res) => {
  const { limit = 20, type, level } = req.query;
  
  try {
    let events = securityMonitoringService.metrics.recentEvents;
    
    // Filter by type if specified
    if (type) {
      events = events.filter(e => e.type === type);
    }
    
    // Filter by level if specified
    if (level) {
      events = events.filter(e => e.level === level);
    }
    
    // Apply limit
    events = events.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('Recent events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent events'
    });
  }
}));

module.exports = router;