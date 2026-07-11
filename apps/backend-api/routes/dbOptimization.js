// Database Optimization Routes
// Provides endpoints for monitoring and optimizing database performance

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const dbOptimizationService = require('../services/dbOptimizationService');
const { practiceAuth, fullClinicAuth } = require('../middleware/practiceAuth');

// @route   GET /api/db-optimization/stats
// @desc    Get query statistics
// @access  Protected (Admin)
router.get('/stats', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const stats = dbOptimizationService.getQueryStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
}));

// @route   GET /api/db-optimization/slow-queries
// @desc    Get slow query report
// @access  Protected (Admin)
router.get('/slow-queries', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const report = dbOptimizationService.getSlowQueryReport();
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Slow query report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate slow query report'
    });
  }
}));

// @route   GET /api/db-optimization/recommendations
// @desc    Get index recommendations
// @access  Protected (Admin)
router.get('/recommendations', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const recommendations = dbOptimizationService.getIndexRecommendations();
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations'
    });
  }
}));

// @route   POST /api/db-optimization/create-indexes
// @desc    Create recommended indexes
// @access  Protected (Admin)
router.post('/create-indexes', fullClinicAuth, asyncHandler(async (req, res) => {
  try {
    // Get database connection from request or use default
    const connection = req.app.locals.databaseFactory?.getConnection(req.practice) || 
                      mongoose.connection;
    
    const created = await dbOptimizationService.createRecommendedIndexes(connection);
    
    res.json({
      success: true,
      message: `Created ${created.length} indexes`,
      indexes: created
    });
  } catch (error) {
    console.error('Index creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create indexes'
    });
  }
}));

// @route   POST /api/db-optimization/invalidate-cache
// @desc    Invalidate query cache
// @access  Protected (Admin)
router.post('/invalidate-cache', fullClinicAuth, asyncHandler(async (req, res) => {
  const { modelName } = req.body;
  
  try {
    dbOptimizationService.invalidateCache(modelName);
    
    res.json({
      success: true,
      message: modelName 
        ? `Cache invalidated for ${modelName}`
        : 'All cache cleared'
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate cache'
    });
  }
}));

// @route   POST /api/db-optimization/optimize-connection
// @desc    Optimize database connection
// @access  Protected (Admin)
router.post('/optimize-connection', fullClinicAuth, asyncHandler(async (req, res) => {
  try {
    const connection = req.app.locals.databaseFactory?.getConnection(req.practice) || 
                      mongoose.connection;
    
    const result = await dbOptimizationService.optimizeConnection(connection);
    
    res.json({
      success: result.optimized,
      message: result.optimized 
        ? 'Connection optimized successfully'
        : 'Optimization failed',
      details: result
    });
  } catch (error) {
    console.error('Connection optimization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize connection'
    });
  }
}));

// @route   POST /api/db-optimization/setup-read-write-split
// @desc    Setup read/write splitting
// @access  Protected (Admin)
router.post('/setup-read-write-split', fullClinicAuth, asyncHandler(async (req, res) => {
  const { primaryUri, secondaryUris } = req.body;
  
  if (!primaryUri) {
    return res.status(400).json({
      success: false,
      message: 'Primary URI required'
    });
  }
  
  try {
    const result = await dbOptimizationService.setupReadWriteSplit(
      primaryUri,
      secondaryUris || []
    );
    
    res.json({
      success: true,
      message: 'Read/write splitting configured',
      connections: {
        write: 1,
        read: result.read.length
      }
    });
  } catch (error) {
    console.error('Read/write split error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup read/write splitting'
    });
  }
}));

// @route   GET /api/db-optimization/pool-status
// @desc    Get connection pool status
// @access  Protected
router.get('/pool-status', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const poolSettings = dbOptimizationService.poolSettings;
    const stats = dbOptimizationService.getQueryStats();
    
    res.json({
      success: true,
      pool: {
        minSize: poolSettings.minPoolSize,
        maxSize: poolSettings.maxPoolSize,
        idleTimeout: poolSettings.maxIdleTimeMS,
        waitTimeout: poolSettings.waitQueueTimeoutMS
      },
      performance: {
        cacheHitRate: stats.cacheHitRate,
        slowQueryRate: stats.slowQueryRate,
        failureRate: stats.failureRate
      }
    });
  } catch (error) {
    console.error('Pool status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pool status'
    });
  }
}));

// @route   POST /api/db-optimization/set-slow-threshold
// @desc    Set slow query threshold
// @access  Protected (Admin)
router.post('/set-slow-threshold', fullClinicAuth, asyncHandler(async (req, res) => {
  const { threshold } = req.body;
  
  if (!threshold || threshold < 1) {
    return res.status(400).json({
      success: false,
      message: 'Valid threshold required (minimum 1ms)'
    });
  }
  
  try {
    dbOptimizationService.slowQueryThreshold = threshold;
    
    res.json({
      success: true,
      message: `Slow query threshold set to ${threshold}ms`
    });
  } catch (error) {
    console.error('Threshold setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set threshold'
    });
  }
}));

// @route   GET /api/db-optimization/cache-info
// @desc    Get cache information
// @access  Protected
router.get('/cache-info', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const cacheInfo = {
      size: dbOptimizationService.queryCache.size,
      maxSize: dbOptimizationService.queryCache.max,
      ttl: dbOptimizationService.queryCache.ttl,
      itemCount: dbOptimizationService.queryCache.size,
      stats: dbOptimizationService.getQueryStats()
    };
    
    res.json({
      success: true,
      cache: cacheInfo
    });
  } catch (error) {
    console.error('Cache info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache information'
    });
  }
}));

module.exports = router;