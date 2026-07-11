const express = require('express');
const router = express.Router();
const SecureDataAccess = require('../services/secureDataAccess');

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const practiceId = req.practice?.id || req.headers['x-practice-subdomain'] || 'global';
    
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'getDashboardStats',
      practiceId: practiceId
    };

    // Get patient count
    const totalPatients = await SecureDataAccess.query('patients',
      {},
      { count: true },
      context
    );

    // Get appointment count for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await SecureDataAccess.query('appointments',
      { appointmentDate: { $gte: today, $lt: tomorrow } },
      { count: true },
      context
    );

    // Get active users
    const activeUsers = await SecureDataAccess.query('users',
      { active: true },
      { count: true },
      context
    );

    res.json({
      success: true,
      stats: {
        totalPatients,
        todayAppointments,
        activeUsers,
        practiceId: practiceId
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const practiceId = req.practice?.id || req.headers['x-practice-subdomain'] || 'global';
    const limit = parseInt(req.query.limit) || 10;
    
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'getRecentActivity',
      practiceId: practiceId
    };

    const activities = await SecureDataAccess.query('auditlogs',
      {},
      { 
        limit: limit,
        sort: { timestamp: -1 },
        projection: { 
          action: 1, 
          userId: 1, 
          timestamp: 1, 
          details: 1 
        }
      },
      context
    );

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      error: 'Failed to fetch recent activity'
    });
  }
});

// Get system health
router.get('/health', async (req, res) => {
  try {
    const masterServiceLoader = require('../services/masterServiceLoader');
    const serviceReport = masterServiceLoader.getReport();
    
    res.json({
      success: true,
      health: {
        status: serviceReport.failed === 0 ? 'healthy' : 'degraded',
        servicesLoaded: serviceReport.loaded,
        servicesFailed: serviceReport.failed,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({
      error: 'Failed to fetch system health'
    });
  }
});

// Get revenue metrics
router.get('/revenue', async (req, res) => {
  try {
    const practiceId = req.practice?.id || req.headers['x-practice-subdomain'] || 'global';
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setDate(1));
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'getRevenueMetrics',
      practiceId: practiceId
    };

    const payments = await SecureDataAccess.query('payments',
      { 
        paymentDate: { $gte: startDate, $lte: endDate },
        status: 'completed'
      },
      { projection: { amount: 1, paymentDate: 1 } },
      context
    );

    const totalRevenue = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

    res.json({
      success: true,
      revenue: {
        total: totalRevenue,
        period: {
          start: startDate,
          end: endDate
        },
        transactionCount: payments.length
      }
    });
  } catch (error) {
    console.error('Error fetching revenue metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch revenue metrics'
    });
  }
});

module.exports = router;