// Cost Tracking API Routes
const express = require('express');
const router = express.Router();
const costTracking = require('../services/costTrackingServiceDB'); // Use database version with encryption
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext } = require('../middleware/practiceContext');

// Get practice totals
router.get('/practice/:practiceId', 
  practiceAuth,  // This sets req.user from token and handles auth
  practiceContext,  // This sets up practice models and context
  async (req, res) => {
  try {
    // Security: Ensure user can only access their own practice's data
    const requestedClinic = req.params.practiceId;
    const userClinic = req.practiceSubdomain || req.user?.practiceId;
    
    if (requestedClinic !== userClinic && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Cannot access other practice data'
      });
    }
    
    const totals = await costTracking.getClinicTotals(requestedClinic);
    res.json({
      success: true,
      totals
    });
  } catch (error) {
    console.error('Error fetching practice totals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user totals
router.get('/user/:practiceId/:userId', 
  practiceAuth,
  practiceContext,
  async (req, res) => {
  try {
    const totals = await costTracking.getUserTotals(req.params.practiceId, req.params.userId);
    res.json({
      success: true,
      totals
    });
  } catch (error) {
    console.error('Error fetching user totals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current month costs
router.get('/month/:practiceId', 
  practiceAuth,
  practiceContext,
  async (req, res) => {
  try {
    const monthCosts = await costTracking.getCurrentMonthCosts(req.params.practiceId);
    res.json({
      success: true,
      monthCosts
    });
  } catch (error) {
    console.error('Error fetching month costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get today's costs
router.get('/today/:practiceId', 
  practiceAuth,
  practiceContext,
  async (req, res) => {
  try {
    const todayCosts = await costTracking.getTodayCosts(req.params.practiceId);
    res.json({
      success: true,
      todayCosts
    });
  } catch (error) {
    console.error('Error fetching today costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user breakdown for practice
router.get('/users/:practiceId', 
  practiceAuth,
  practiceContext,
  async (req, res) => {
  try {
    const users = await costTracking.getClinicUserBreakdown(req.params.practiceId);
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching user breakdown:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get billing report
router.get('/report/:practiceId', 
  practiceAuth,
  practiceContext,
  async (req, res) => {
  try {
    const report = await costTracking.generateBillingReport(req.params.practiceId);
    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get TOTAL amount across ALL practices (for billing)
router.get('/total', 
  practiceAuth,
  practiceContext,
  async (req, res) => {
  try {
    const totalAmount = await costTracking.getTotalAmount();
    res.json({
      success: true,
      totalAmount
    });
  } catch (error) {
    console.error('Error fetching total amount:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset practice costs (admin only)
router.post('/reset/:practiceId', 
  practiceAuth,
  practiceContext,
  async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const result = await costTracking.resetClinicCosts(req.params.practiceId);
    res.json(result);
  } catch (error) {
    console.error('Error resetting costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

/* API Endpoints:

GET /api/cost-tracking/total - Get TOTAL amount across ALL practices
GET /api/cost-tracking/practice/:practiceId - Get total costs for practice
GET /api/cost-tracking/user/:practiceId/:userId - Get costs for specific user
GET /api/cost-tracking/month/:practiceId - Get current month costs
GET /api/cost-tracking/today/:practiceId - Get today's costs
GET /api/cost-tracking/users/:practiceId - Get all users with their costs
GET /api/cost-tracking/report/:practiceId - Get comprehensive billing report
POST /api/cost-tracking/reset/:practiceId - Reset practice costs (admin only)

*/