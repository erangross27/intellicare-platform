// API Versioning Routes
// Provides endpoints for version information and migration

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const apiVersioningService = require('../services/apiVersioningService');

// @route   GET /api/versions
// @desc    Get available API versions
// @access  Public
router.get('/versions', asyncHandler(async (req, res) => {
  try {
    const versions = apiVersioningService.getAvailableVersions();
    
    res.json({
      success: true,
      current: apiVersioningService.defaultVersion,
      latest: apiVersioningService.latestStableVersion,
      versions
    });
  } catch (error) {
    console.error('Version listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve versions'
    });
  }
}));

// @route   GET /api/versions/:version/info
// @desc    Get detailed information about a version
// @access  Public
router.get('/versions/:version/info', asyncHandler(async (req, res) => {
  const { version } = req.params;
  
  if (!apiVersioningService.isValidVersion(version)) {
    return res.status(404).json({
      success: false,
      message: `Version ${version} not found`
    });
  }
  
  try {
    const versionInfo = apiVersioningService.versions[version];
    
    res.json({
      success: true,
      version,
      info: {
        status: versionInfo.status,
        description: versionInfo.description,
        releaseDate: versionInfo.releaseDate,
        deprecationDate: versionInfo.deprecationDate,
        sunsetDate: versionInfo.sunsetDate,
        changes: versionInfo.changes || [],
        endpoints: Array.from(versionInfo.endpoints)
      }
    });
  } catch (error) {
    console.error('Version info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve version information'
    });
  }
}));

// @route   GET /api/migration/:from-to-:to
// @desc    Get migration guide between versions
// @access  Public
router.get('/migration/:from-to-:to', asyncHandler(async (req, res) => {
  const { from, to } = req.params;
  
  try {
    const guide = apiVersioningService.getMigrationGuide(from, to);
    
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: `No migration guide available from ${from} to ${to}`
      });
    }
    
    res.json({
      success: true,
      migration: guide
    });
  } catch (error) {
    console.error('Migration guide error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve migration guide'
    });
  }
}));

// @route   GET /api/versions/stats
// @desc    Get version usage statistics
// @access  Protected (Admin)
router.get('/versions/stats', asyncHandler(async (req, res) => {
  try {
    const stats = apiVersioningService.getVersionStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Version stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve version statistics'
    });
  }
}));

// @route   GET /api/versions/:version/openapi
// @desc    Get OpenAPI specification for version
// @access  Public
router.get('/versions/:version/openapi', asyncHandler(async (req, res) => {
  const { version } = req.params;
  
  if (!apiVersioningService.isValidVersion(version)) {
    return res.status(404).json({
      success: false,
      message: `Version ${version} not found`
    });
  }
  
  try {
    const spec = apiVersioningService.generateOpenAPISpec(version);
    
    res.json(spec);
  } catch (error) {
    console.error('OpenAPI spec error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate OpenAPI specification'
    });
  }
}));

// @route   POST /api/versions/deprecate-endpoint
// @desc    Mark an endpoint as deprecated
// @access  Protected (Admin)
router.post('/versions/deprecate-endpoint', asyncHandler(async (req, res) => {
  const { endpoint, message, alternative } = req.body;
  
  if (!endpoint || !message) {
    return res.status(400).json({
      success: false,
      message: 'Endpoint and message required'
    });
  }
  
  try {
    apiVersioningService.addDeprecationWarning(endpoint, message, alternative);
    
    res.json({
      success: true,
      message: `Endpoint ${endpoint} marked as deprecated`
    });
  } catch (error) {
    console.error('Deprecation marking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark endpoint as deprecated'
    });
  }
}));

// @route   GET /api/versions/compatibility/:v1/:v2
// @desc    Check if two versions are compatible
// @access  Public
router.get('/versions/compatibility/:v1/:v2', asyncHandler(async (req, res) => {
  const { v1, v2 } = req.params;
  
  try {
    const compatible = apiVersioningService.areVersionsCompatible(v1, v2);
    
    res.json({
      success: true,
      v1,
      v2,
      compatible,
      message: compatible 
        ? `Versions ${v1} and ${v2} are compatible`
        : `Versions ${v1} and ${v2} are not compatible`
    });
  } catch (error) {
    console.error('Compatibility check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check compatibility'
    });
  }
}));

// @route   GET /api/versions/rate-limits
// @desc    Get rate limits for all versions
// @access  Public
router.get('/versions/rate-limits', asyncHandler(async (req, res) => {
  try {
    const rateLimits = {};
    
    Object.keys(apiVersioningService.versions).forEach(version => {
      rateLimits[version] = apiVersioningService.getRateLimit(version);
    });
    
    res.json({
      success: true,
      rateLimits
    });
  } catch (error) {
    console.error('Rate limits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate limits'
    });
  }
}));

// @route   POST /api/versions/:version/register-endpoint
// @desc    Register an endpoint for a version
// @access  Protected (Admin)
router.post('/versions/:version/register-endpoint', asyncHandler(async (req, res) => {
  const { version } = req.params;
  const { endpoint } = req.body;
  
  if (!endpoint) {
    return res.status(400).json({
      success: false,
      message: 'Endpoint required'
    });
  }
  
  if (!apiVersioningService.isValidVersion(version)) {
    return res.status(404).json({
      success: false,
      message: `Version ${version} not found`
    });
  }
  
  try {
    apiVersioningService.registerEndpoint(version, endpoint);
    
    res.json({
      success: true,
      message: `Endpoint ${endpoint} registered for version ${version}`
    });
  } catch (error) {
    console.error('Endpoint registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register endpoint'
    });
  }
}));

// @route   GET /api/versions/deprecated
// @desc    Get list of deprecated versions and endpoints
// @access  Public
router.get('/versions/deprecated', asyncHandler(async (req, res) => {
  try {
    const deprecated = {
      versions: [],
      endpoints: []
    };
    
    // Find deprecated versions
    Object.keys(apiVersioningService.versions).forEach(version => {
      if (apiVersioningService.isDeprecated(version)) {
        deprecated.versions.push({
          version,
          sunsetDate: apiVersioningService.getSunsetDate(version),
          migrateTo: apiVersioningService.latestStableVersion
        });
      }
    });
    
    // Get deprecated endpoints
    apiVersioningService.deprecationWarnings.forEach((warning, endpoint) => {
      deprecated.endpoints.push({
        endpoint,
        message: warning.message,
        alternative: warning.alternative
      });
    });
    
    res.json({
      success: true,
      deprecated
    });
  } catch (error) {
    console.error('Deprecated list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deprecated items'
    });
  }
}));

module.exports = router;