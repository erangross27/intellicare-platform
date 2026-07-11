const express = require('express');
const router = express.Router();
const SecureDataAccess = require('../services/secureDataAccess');

// Get practice information
router.get('/info', async (req, res) => {
  try {
    const practiceId = req.practice?.id || req.headers['x-practice-subdomain'];
    
    if (!practiceId) {
      return res.status(400).json({
        error: 'Practice ID required'
      });
    }

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'getClinicInfo',
      practiceId: practiceId
    };

    const practice = await SecureDataAccess.query('practices', 
      { subdomain: practiceId }, 
      { limit: 1 }, 
      context
    );

    if (!practice || practice.length === 0) {
      return res.status(404).json({
        error: 'Practice not found'
      });
    }

    res.json({
      success: true,
      practice: practice[0]
    });
  } catch (error) {
    console.error('Error fetching practice info:', error);
    res.status(500).json({
      error: 'Failed to fetch practice information'
    });
  }
});

// Update practice settings
router.put('/settings', async (req, res) => {
  try {
    const practiceId = req.practice?.id || req.headers['x-practice-subdomain'];
    
    if (!practiceId) {
      return res.status(400).json({
        error: 'Practice ID required'
      });
    }

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'updateClinicSettings',
      practiceId: practiceId
    };

    const result = await SecureDataAccess.update('practices',
      { subdomain: practiceId },
      { settings: req.body },
      context
    );

    res.json({
      success: true,
      message: 'Practice settings updated',
      result
    });
  } catch (error) {
    console.error('Error updating practice settings:', error);
    res.status(500).json({
      error: 'Failed to update practice settings'
    });
  }
});

// Get practice staff
router.get('/staff', async (req, res) => {
  try {
    const practiceId = req.practice?.id || req.headers['x-practice-subdomain'];
    
    if (!practiceId) {
      return res.status(400).json({
        error: 'Practice ID required'
      });
    }

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'getClinicStaff',
      practiceId: practiceId
    };

    const staff = await SecureDataAccess.query('users',
      { practiceId: practiceId, role: { $in: ['doctor', 'nurse', 'admin', 'user'] } },
      { projection: { password: 0, apiKey: 0 } },
      context
    );

    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Error fetching practice staff:', error);
    res.status(500).json({
      error: 'Failed to fetch practice staff'
    });
  }
});

module.exports = router;