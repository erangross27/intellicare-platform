// API Versioning Middleware
// Handles version routing, deprecation, and compatibility

const apiVersioningService = require('../services/apiVersioningService');

/**
 * Version detection and validation middleware
 */
const versionMiddleware = (req, res, next) => {
  // Get requested version
  const version = apiVersioningService.getRequestedVersion(req);
  
  // Store version in request
  req.apiVersion = version;
  
  // Check if version is valid
  if (!apiVersioningService.isValidVersion(version)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid API version',
      message: `Version ${version} is not supported`,
      availableVersions: apiVersioningService.getAvailableVersions()
    });
  }
  
  // Check if version is sunset
  if (apiVersioningService.isSunset(version)) {
    return res.status(410).json({
      success: false,
      error: 'API version sunset',
      message: `Version ${version} has been sunset and is no longer available`,
      sunsetDate: apiVersioningService.getSunsetDate(version),
      currentVersion: apiVersioningService.latestStableVersion
    });
  }
  
  // Add deprecation headers if needed
  const headers = apiVersioningService.getDeprecationHeaders(version);
  Object.keys(headers).forEach(key => {
    res.setHeader(key, headers[key]);
  });
  
  // Track usage
  apiVersioningService.trackUsage(version, req.path, req.method);
  
  next();
};

/**
 * Version-specific rate limiting
 */
const versionRateLimit = (req, res, next) => {
  const version = req.apiVersion || apiVersioningService.defaultVersion;
  const rateLimitConfig = apiVersioningService.getRateLimit(version);
  
  // Store rate limit info in response headers
  res.setHeader('X-RateLimit-Version', version);
  res.setHeader('X-RateLimit-Limit', rateLimitConfig.max);
  res.setHeader('X-RateLimit-Window', rateLimitConfig.windowMs);
  
  next();
};

/**
 * Backward compatibility transformer
 */
const backwardCompatibility = (req, res, next) => {
  const requestedVersion = req.apiVersion;
  const currentVersion = apiVersioningService.latestStableVersion;
  
  // Check if transformation is needed
  if (requestedVersion !== currentVersion) {
    // Transform request for compatibility
    apiVersioningService.transformRequest(req, requestedVersion, currentVersion);
    
    // Override response.json to transform response
    const originalJson = res.json;
    res.json = function(data) {
      // Transform response back to requested version format
      const transformedData = apiVersioningService.transformResponse(
        res,
        data,
        currentVersion,
        requestedVersion
      );
      return originalJson.call(this, transformedData);
    };
  }
  
  next();
};

/**
 * Endpoint deprecation checker
 */
const deprecationChecker = (req, res, next) => {
  const endpoint = req.path;
  const warning = apiVersioningService.getDeprecationWarning(endpoint);
  
  if (warning) {
    res.setHeader('X-Endpoint-Deprecated', 'true');
    res.setHeader('X-Deprecation-Message', warning.message);
    if (warning.alternative) {
      res.setHeader('X-Alternative-Endpoint', warning.alternative);
    }
  }
  
  next();
};

/**
 * Version router - routes requests to version-specific handlers
 */
const versionRouter = (versions) => {
  return (req, res, next) => {
    const version = req.apiVersion || apiVersioningService.defaultVersion;
    
    // Check if we have a handler for this version
    if (versions[version]) {
      return versions[version](req, res, next);
    }
    
    // Fall back to default or latest version
    const fallbackVersion = versions[apiVersioningService.defaultVersion] || 
                           versions[apiVersioningService.latestStableVersion];
    
    if (fallbackVersion) {
      return fallbackVersion(req, res, next);
    }
    
    next();
  };
};

/**
 * Migration helper middleware
 */
const migrationHelper = (req, res, next) => {
  // Add migration info to response if switching versions
  const currentVersion = req.apiVersion;
  const targetVersion = req.headers['x-migrate-to-version'];
  
  if (targetVersion && targetVersion !== currentVersion) {
    const guide = apiVersioningService.getMigrationGuide(currentVersion, targetVersion);
    
    if (guide) {
      res.setHeader('X-Migration-Available', 'true');
      res.setHeader('X-Migration-Guide', `/api/migration/${currentVersion}-to-${targetVersion}`);
    }
  }
  
  next();
};

/**
 * Version documentation middleware
 */
const versionDocs = (req, res, next) => {
  // Serve version-specific documentation
  if (req.path === '/docs' || req.path === '/openapi') {
    const version = req.apiVersion || apiVersioningService.defaultVersion;
    const spec = apiVersioningService.generateOpenAPISpec(version);
    
    if (spec) {
      return res.json(spec);
    }
  }
  
  next();
};

/**
 * Combined API versioning middleware
 */
const apiVersioning = [
  versionMiddleware,
  versionRateLimit,
  deprecationChecker,
  backwardCompatibility,
  migrationHelper
];

module.exports = {
  versionMiddleware,
  versionRateLimit,
  backwardCompatibility,
  deprecationChecker,
  versionRouter,
  migrationHelper,
  versionDocs,
  apiVersioning
};