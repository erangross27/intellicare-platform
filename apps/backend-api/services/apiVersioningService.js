// API Versioning Service
// Manages API versions, deprecation, and migration

const semver = require('semver');

class APIVersioningService {
  constructor() {
    // Current API versions
    this.versions = {
      v1: {
        version: '1.0.0',
        status: 'deprecated',
        deprecationDate: new Date('2024-06-01'),
        sunsetDate: new Date('2024-12-31'),
        description: 'Initial API version',
        endpoints: new Set()
      },
      v2: {
        version: '2.0.0',
        status: 'stable',
        releaseDate: new Date('2024-06-01'),
        description: 'Enhanced security and performance',
        endpoints: new Set(),
        changes: [
          'Improved authentication with zero-knowledge proof',
          'Added end-to-end encryption',
          'Enhanced rate limiting',
          'Better error responses'
        ]
      },
      v3: {
        version: '3.0.0',
        status: 'beta',
        releaseDate: new Date('2025-01-01'),
        description: 'Next generation API with GraphQL support',
        endpoints: new Set(),
        changes: [
          'GraphQL endpoint support',
          'WebSocket subscriptions',
          'Batch operations',
          'Advanced filtering'
        ]
      }
    };
    
    // Default version
    this.defaultVersion = 'v2';
    this.latestStableVersion = 'v2';
    
    // Version compatibility matrix
    this.compatibility = {
      v1: {
        compatibleWith: ['v1'],
        migrationPath: ['v1', 'v2']
      },
      v2: {
        compatibleWith: ['v1', 'v2'],
        migrationPath: ['v2']
      },
      v3: {
        compatibleWith: ['v2', 'v3'],
        migrationPath: ['v2', 'v3']
      }
    };
    
    // Deprecation warnings
    this.deprecationWarnings = new Map();
    
    // Rate limits per version
    this.versionRateLimits = {
      v1: {
        windowMs: 60000,
        max: 50,
        message: 'Rate limit exceeded for v1 API'
      },
      v2: {
        windowMs: 60000,
        max: 100,
        message: 'Rate limit exceeded for v2 API'
      },
      v3: {
        windowMs: 60000,
        max: 200,
        message: 'Rate limit exceeded for v3 API'
      }
    };
    
    // Migration guides
    this.migrationGuides = new Map();
    this.setupMigrationGuides();
    
    // Version metrics
    this.versionMetrics = new Map();
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('api-versioning');
    return this;
  }
  
  /**
   * Setup migration guides
   */
  setupMigrationGuides() {
    // v1 to v2 migration guide
    this.migrationGuides.set('v1-to-v2', {
      from: 'v1',
      to: 'v2',
      breaking_changes: [
        {
          endpoint: '/api/auth/login',
          change: 'Response structure changed',
          before: '{ token: string }',
          after: '{ success: boolean, token: string, expiresIn: number }',
          migration: 'Update client to handle new response structure'
        },
        {
          endpoint: '/api/patients',
          change: 'Pagination parameters changed',
          before: 'page, limit',
          after: 'offset, limit',
          migration: 'Replace page with offset = (page - 1) * limit'
        }
      ],
      new_features: [
        'Zero-knowledge authentication at /api/zkauth',
        'End-to-end encryption at /api/e2e',
        'Real-time monitoring via WebSocket'
      ],
      deprecated_endpoints: [
        {
          old: '/api/user/profile',
          new: '/api/users/profile',
          reason: 'Endpoint naming consistency'
        }
      ]
    });
    
    // v2 to v3 migration guide
    this.migrationGuides.set('v2-to-v3', {
      from: 'v2',
      to: 'v3',
      breaking_changes: [
        {
          endpoint: '/api/graphql',
          change: 'New GraphQL endpoint',
          migration: 'Implement GraphQL client for advanced queries'
        }
      ],
      new_features: [
        'GraphQL API endpoint',
        'Subscription support',
        'Batch operations',
        'Field-level permissions'
      ]
    });
  }
  
  /**
   * Get version from request
   */
  getRequestedVersion(req) {
    // Check header first
    let version = req.headers['x-api-version'];
    
    // Check URL path
    if (!version) {
      const pathMatch = req.path.match(/^\/(v\d+)\//);
      if (pathMatch) {
        version = pathMatch[1];
      }
    }
    
    // Check query parameter
    if (!version) {
      version = req.query.api_version;
    }
    
    // Use default if not specified
    return version || this.defaultVersion;
  }
  
  /**
   * Validate version
   */
  isValidVersion(version) {
    return this.versions.hasOwnProperty(version);
  }
  
  /**
   * Check if version is deprecated
   */
  isDeprecated(version) {
    return this.versions[version]?.status === 'deprecated';
  }
  
  /**
   * Check if version is sunset
   */
  isSunset(version) {
    const versionInfo = this.versions[version];
    if (!versionInfo || !versionInfo.sunsetDate) return false;
    return new Date() > versionInfo.sunsetDate;
  }
  
  /**
   * Get deprecation headers
   */
  getDeprecationHeaders(version) {
    const headers = {};
    const versionInfo = this.versions[version];
    
    if (!versionInfo) return headers;
    
    if (this.isDeprecated(version)) {
      headers['Deprecation'] = 'true';
      headers['Sunset'] = versionInfo.sunsetDate?.toISOString() || '';
      headers['Link'] = `</api/${this.latestStableVersion}>; rel="successor-version"`;
      headers['Warning'] = `299 - "This API version is deprecated. Please migrate to ${this.latestStableVersion}"`;
    }
    
    // Always include version info
    headers['X-API-Version'] = version;
    headers['X-API-Version-Status'] = versionInfo.status;
    
    return headers;
  }
  
  /**
   * Register endpoint for version
   */
  registerEndpoint(version, endpoint) {
    if (this.versions[version]) {
      this.versions[version].endpoints.add(endpoint);
    }
  }
  
  /**
   * Get version-specific rate limit
   */
  getRateLimit(version) {
    return this.versionRateLimits[version] || this.versionRateLimits[this.defaultVersion];
  }
  
  /**
   * Transform request for backward compatibility
   */
  transformRequest(req, fromVersion, toVersion) {
    const transformations = {
      'v1-to-v2': {
        '/api/patients': (req) => {
          // Transform pagination
          if (req.query.page) {
            req.query.offset = (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 10);
            delete req.query.page;
          }
        },
        '/api/auth/login': (req) => {
          // Transform auth request
          if (req.body.user) {
            req.body.username = req.body.user;
            delete req.body.user;
          }
        }
      }
    };
    
    const key = `${fromVersion}-to-${toVersion}`;
    const transformer = transformations[key];
    
    if (transformer && transformer[req.path]) {
      transformer[req.path](req);
    }
  }
  
  /**
   * Transform response for backward compatibility
   */
  transformResponse(res, data, fromVersion, toVersion) {
    const transformations = {
      'v2-to-v1': {
        '/api/auth/login': (data) => {
          // Simplify response for v1
          if (data.success && data.token) {
            return { token: data.token };
          }
          return data;
        },
        '/api/patients': (data) => {
          // Transform pagination response
          if (data.offset !== undefined) {
            data.page = Math.floor(data.offset / data.limit) + 1;
            delete data.offset;
          }
          return data;
        }
      }
    };
    
    const key = `${fromVersion}-to-${toVersion}`;
    const transformer = transformations[key];
    
    if (transformer && transformer[res.req.path]) {
      return transformer[res.req.path](data);
    }
    
    return data;
  }
  
  /**
   * Get migration guide
   */
  getMigrationGuide(fromVersion, toVersion) {
    const key = `${fromVersion}-to-${toVersion}`;
    return this.migrationGuides.get(key);
  }
  
  /**
   * Track version usage
   */
  trackUsage(version, endpoint, method) {
    const key = `${version}:${method}:${endpoint}`;
    
    if (!this.versionMetrics.has(key)) {
      this.versionMetrics.set(key, {
        count: 0,
        lastAccessed: null,
        version,
        endpoint,
        method
      });
    }
    
    const metric = this.versionMetrics.get(key);
    metric.count++;
    metric.lastAccessed = new Date();
  }
  
  /**
   * Get version statistics
   */
  getVersionStats() {
    const stats = {
      versions: {},
      totalRequests: 0,
      deprecatedUsage: 0
    };
    
    // Initialize version stats
    Object.keys(this.versions).forEach(v => {
      stats.versions[v] = {
        status: this.versions[v].status,
        requests: 0,
        endpoints: this.versions[v].endpoints.size
      };
    });
    
    // Aggregate metrics
    for (const [key, metric] of this.versionMetrics) {
      const version = metric.version;
      stats.versions[version].requests += metric.count;
      stats.totalRequests += metric.count;
      
      if (this.isDeprecated(version)) {
        stats.deprecatedUsage += metric.count;
      }
    }
    
    // Calculate percentages
    Object.keys(stats.versions).forEach(v => {
      stats.versions[v].percentage = stats.totalRequests > 0
        ? ((stats.versions[v].requests / stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%';
    });
    
    return stats;
  }
  
  /**
   * Get available versions
   */
  getAvailableVersions() {
    return Object.keys(this.versions).map(v => ({
      version: v,
      status: this.versions[v].status,
      description: this.versions[v].description
    }));
  }
  
  /**
   * Check version compatibility
   */
  areVersionsCompatible(v1, v2) {
    const compatibility = this.compatibility[v1];
    return compatibility ? compatibility.compatibleWith.includes(v2) : false;
  }
  
  /**
   * Get sunset date for version
   */
  getSunsetDate(version) {
    return this.versions[version]?.sunsetDate;
  }
  
  /**
   * Add custom deprecation warning
   */
  addDeprecationWarning(endpoint, message, alternativeEndpoint) {
    this.deprecationWarnings.set(endpoint, {
      message,
      alternative: alternativeEndpoint,
      added: new Date()
    });
  }
  
  /**
   * Get deprecation warning for endpoint
   */
  getDeprecationWarning(endpoint) {
    return this.deprecationWarnings.get(endpoint);
  }
  
  /**
   * Generate OpenAPI spec for version
   */
  generateOpenAPISpec(version) {
    const versionInfo = this.versions[version];
    
    if (!versionInfo) return null;
    
    return {
      openapi: '3.0.0',
      info: {
        title: 'IntelliCare API',
        version: versionInfo.version,
        description: versionInfo.description,
        'x-api-status': versionInfo.status,
        'x-deprecation-date': versionInfo.deprecationDate,
        'x-sunset-date': versionInfo.sunsetDate
      },
      servers: [
        {
          url: `{protocol}://{host}/api/${version}`,
          variables: {
            protocol: {
              enum: ['http', 'https'],
              default: 'https'
            },
            host: {
              default: 'localhost:5000'
            }
          }
        }
      ],
      paths: this.generatePaths(version),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    };
  }
  
  /**
   * Generate paths for OpenAPI spec
   */
  generatePaths(version) {
    const paths = {};
    
    // Add endpoints registered for this version
    for (const endpoint of this.versions[version].endpoints) {
      paths[endpoint] = {
        get: {
          summary: `GET ${endpoint}`,
          tags: [version],
          responses: {
            '200': {
              description: 'Successful response'
            }
          }
        }
      };
    }
    
    return paths;
  }
  
  /**
   * Initialize service
   */
  initialize() {
    // API Versioning Service initialized with deprecation management
    
    return true;
  }
}

// Export singleton instance
module.exports = new APIVersioningService();