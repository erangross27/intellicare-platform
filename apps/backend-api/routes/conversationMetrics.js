/**
 * Task 40: Monitoring Dashboard Route
 * Provides real-time metrics for the conversation system
 */

const express = require('express');
const router = express.Router();
const conversationMonitoring = require('../services/conversationMonitoring');
const enhancedConversationSystem = require('../services/enhancedConversationSystem');
const { practiceAuth } = require('../middleware/practiceAuth');

/**
 * @route   GET /api/conversation-metrics/dashboard
 * @desc    Get real-time dashboard data
 * @access  Private (admin only)
 */
router.get('/dashboard', practiceAuth, (req, res) => {
    try {
        // Check admin permission
        if (!req.user?.roles?.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const dashboard = conversationMonitoring.getDashboard();

        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard data'
        });
    }
});

/**
 * @route   GET /api/conversation-metrics/detailed
 * @desc    Get detailed metrics
 * @access  Private (admin only)
 */
router.get('/detailed', practiceAuth, (req, res) => {
    try {
        // Check admin permission
        if (!req.user?.roles?.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const metrics = conversationMonitoring.getMetrics();
        const systemStats = enhancedConversationSystem.getStatistics();

        res.json({
            success: true,
            data: {
                monitoring: metrics,
                system: systemStats
            }
        });
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve metrics'
        });
    }
});

/**
 * @route   GET /api/conversation-metrics/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
    try {
        const metrics = conversationMonitoring.getMetrics();
        const status = conversationMonitoring.getSystemStatus(metrics);

        res.json({
            success: true,
            status: status,
            timestamp: new Date(),
            uptime: process.uptime(),
            metrics: {
                responseTime: metrics.responseTime.avg.toFixed(2) + 'ms',
                cacheHitRate: (metrics.cache.hitRate * 100).toFixed(1) + '%',
                modeAccuracy: (metrics.modeDetection.accuracy * 100).toFixed(1) + '%',
                errorRate: (metrics.errors.rate * 100).toFixed(2) + '%'
            }
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            success: false,
            status: 'error',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/conversation-metrics/reset
 * @desc    Reset metrics (admin only)
 * @access  Private (admin only)
 */
router.post('/reset', practiceAuth, (req, res) => {
    try {
        // Check admin permission
        if (!req.user?.roles?.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        conversationMonitoring.reset();

        res.json({
            success: true,
            message: 'Metrics reset successfully'
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset metrics'
        });
    }
});

/**
 * @route   GET /api/conversation-metrics/alerts
 * @desc    Get active alerts
 * @access  Private (admin only)
 */
router.get('/alerts', practiceAuth, (req, res) => {
    try {
        // Check admin permission
        if (!req.user?.roles?.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const metrics = conversationMonitoring.getMetrics();

        res.json({
            success: true,
            data: {
                active: metrics.alerts,
                count: metrics.alerts.length
            }
        });
    } catch (error) {
        console.error('Alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve alerts'
        });
    }
});

module.exports = router;