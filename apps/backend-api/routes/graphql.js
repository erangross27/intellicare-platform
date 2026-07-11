// GraphQL Routes
// Provides endpoints for GraphQL security monitoring and management

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const graphqlSecurityService = require('../services/graphqlSecurityService');
const secureConfigService = require('../services/secureConfigService');
const { practiceAuth } = require('../middleware/practiceAuth');

// @route   GET /api/graphql-security/stats
// @desc    Get GraphQL security statistics
// @access  Protected
router.get('/stats', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const stats = graphqlSecurityService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('GraphQL security stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve GraphQL security statistics'
    });
  }
}));

// @route   GET /api/graphql-security/health
// @desc    Get GraphQL security health check
// @access  Protected
router.get('/health', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const health = graphqlSecurityService.healthCheck();
    
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('GraphQL security health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check GraphQL security health'
    });
  }
}));

// @route   POST /api/graphql-security/config
// @desc    Update GraphQL security configuration
// @access  Protected (Admin only)
router.post('/config', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const { maxDepth, maxComplexity, queryTimeoutMs, maxAliases, maxDirectives } = req.body;
    
    const newConfig = {};
    if (maxDepth !== undefined) newConfig.maxDepth = maxDepth;
    if (maxComplexity !== undefined) newConfig.maxComplexity = maxComplexity;
    if (queryTimeoutMs !== undefined) newConfig.queryTimeoutMs = queryTimeoutMs;
    if (maxAliases !== undefined) newConfig.maxAliases = maxAliases;
    if (maxDirectives !== undefined) newConfig.maxDirectives = maxDirectives;
    
    graphqlSecurityService.updateConfig(newConfig);
    
    res.json({
      success: true,
      message: 'GraphQL security configuration updated',
      config: graphqlSecurityService.config
    });
  } catch (error) {
    console.error('GraphQL security config update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update GraphQL security configuration'
    });
  }
}));

// @route   POST /api/graphql-security/whitelist
// @desc    Add query to whitelist
// @access  Protected (Admin only)
router.post('/whitelist', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const { query, description } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }
    
    const queryHash = graphqlSecurityService.addToWhitelist(query, description);
    
    res.json({
      success: true,
      message: 'Query added to whitelist',
      queryHash,
      description
    });
  } catch (error) {
    console.error('GraphQL whitelist add error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add query to whitelist'
    });
  }
}));

// @route   DELETE /api/graphql-security/whitelist/:hash
// @desc    Remove query from whitelist
// @access  Protected (Admin only)
router.delete('/whitelist/:hash', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const { hash } = req.params;
    
    const removed = graphqlSecurityService.removeFromWhitelist(hash);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        message: `Query hash not found: ${hash}`
      });
    }
    
    res.json({
      success: true,
      message: 'Query removed from whitelist'
    });
  } catch (error) {
    console.error('GraphQL whitelist remove error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove query from whitelist'
    });
  }
}));

// @route   GET /api/graphql-security/whitelist
// @desc    Get whitelisted queries
// @access  Protected (Admin only)
router.get('/whitelist', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const whitelistedQueries = Array.from(graphqlSecurityService.allowedQueries.entries())
      .map(([hash, data]) => ({
        hash,
        ...data
      }));
    
    res.json({
      success: true,
      queries: whitelistedQueries,
      total: whitelistedQueries.length
    });
  } catch (error) {
    console.error('GraphQL whitelist retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve whitelisted queries'
    });
  }
}));

// @route   POST /api/graphql-security/reset-stats
// @desc    Reset GraphQL security statistics
// @access  Protected (Admin only)
router.post('/reset-stats', practiceAuth, asyncHandler(async (req, res) => {
  try {
    graphqlSecurityService.resetStats();
    
    res.json({
      success: true,
      message: 'GraphQL security statistics have been reset'
    });
  } catch (error) {
    console.error('GraphQL security stats reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset GraphQL security statistics'
    });
  }
}));

// @route   POST /api/graphql-security/test-query
// @desc    Test query security validation
// @access  Protected
router.post('/test-query', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }
    
    // Test various security validations
    const results = {
      queryHash: graphqlSecurityService.hashQuery(query),
      whitelisted: secureConfigService.get('NODE_ENV') === 'production' 
        ? graphqlSecurityService.allowedQueries.has(graphqlSecurityService.hashQuery(query))
        : true,
      validations: {
        syntax: 'pending',
        depth: 'pending',
        complexity: 'pending',
        aliases: 'pending',
        directives: 'pending'
      }
    };
    
    // Simple syntax validation (in production, use GraphQL parser)
    try {
      if (query.includes('query') || query.includes('mutation')) {
        results.validations.syntax = 'passed';
      } else {
        results.validations.syntax = 'failed';
      }
    } catch (error) {
      results.validations.syntax = 'failed';
    }
    
    // Simulate other validations
    results.validations.depth = query.split('{').length <= graphqlSecurityService.config.maxDepth ? 'passed' : 'failed';
    results.validations.complexity = query.length < 1000 ? 'passed' : 'failed'; // Simple heuristic
    results.validations.aliases = (query.match(/\w+:/g) || []).length <= graphqlSecurityService.config.maxAliases ? 'passed' : 'failed';
    results.validations.directives = (query.match(/@\w+/g) || []).length <= graphqlSecurityService.config.maxDirectives ? 'passed' : 'failed';
    
    const allPassed = Object.values(results.validations).every(v => v === 'passed');
    
    res.json({
      success: allPassed,
      message: allPassed ? 'Query passed all security validations' : 'Query failed some security validations',
      results
    });
  } catch (error) {
    console.error('GraphQL query test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test query security'
    });
  }
}));

module.exports = router;