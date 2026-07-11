/**
 * GraphQL Security Service - DDD/NX Modular Version
 * Provides comprehensive security controls for GraphQL endpoints
 * Migrated from legacy backend/services structure to DDD/NX architecture
 */

const { GraphQLError } = require('graphql');
const depthLimit = require('graphql-depth-limit');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { shield, rule, and, or, not, inputRule } = require('graphql-shield');

// Use updated path depth for imports
const secureConfigService = require('../../../../../backend/services/secureConfigService');
const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');

class GraphQLSecurityService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    
    // Configuration
    this.config = {
      maxDepth: 10,
      maxComplexity: 1000,
      introspectionDisabled: secureConfigService.get('NODE_ENV') === 'production',
      queryTimeoutMs: 30000,
      maxAliases: 15,
      maxDirectives: 50,
      scalarLeafRule: true
    };

    // Rate limiters for different operations
    this.rateLimiters = {
      query: new RateLimiterMemory({
        keyGenerator: (req) => req.ip,
        points: 100, // Number of points
        duration: 60, // Per 60 seconds
      }),
      mutation: new RateLimiterMemory({
        keyGenerator: (req) => req.ip,
        points: 20, // Fewer mutations allowed
        duration: 60,
      }),
      introspection: new RateLimiterMemory({
        keyGenerator: (req) => req.ip,
        points: 5, // Very limited introspection
        duration: 3600, // Per hour
      })
    };

    // Query whitelist (production)
    this.allowedQueries = new Map();
    
    // Query complexity costs
    this.fieldCosts = {
      default: 1,
      patients: 10,
      documents: 15,
      diagnostics: 20,
      complexAnalysis: 50
    };

    // Security statistics
    this.stats = {
      totalQueries: 0,
      blockedQueries: 0,
      complexQueries: 0,
      deepQueries: 0,
      rateLimitedQueries: 0,
      errors: new Map()
    };

    this.initializeRules();
  }

  async initialize() {
    if (this.initialized) return;
    this.serviceToken = await serviceAccountManager.authenticate('graphql-security-service');
    this.initialized = true;
  }

  /**
   * Initialize GraphQL Shield rules
   */
  initializeRules() {
    // Authentication rule
    this.isAuthenticated = rule({ cache: 'contextual' })(
      async (parent, args, context) => {
        const token = context.req?.headers?.authorization?.replace('Bearer ', '');
        
        if (!token) {
          this.recordSecurityEvent('AUTH_MISSING_TOKEN');
          return new GraphQLError('Authentication required');
        }

        // Verify token (simplified for demo)
        try {
          // In production, verify JWT token properly
          context.user = { id: 'demo-user', role: 'user' };
          return true;
        } catch (error) {
          this.recordSecurityEvent('AUTH_INVALID_TOKEN');
          return new GraphQLError('Invalid authentication token');
        }
      }
    );

    // Role-based access
    this.isAdmin = rule({ cache: 'contextual' })(
      async (parent, args, context) => {
        if (!context.user || context.user.role !== 'admin') {
          this.recordSecurityEvent('AUTH_INSUFFICIENT_ROLE');
          return new GraphQLError('Admin access required');
        }
        return true;
      }
    );

    this.isDoctor = rule({ cache: 'contextual' })(
      async (parent, args, context) => {
        if (!context.user || !['doctor', 'admin'].includes(context.user.role)) {
          this.recordSecurityEvent('AUTH_INSUFFICIENT_ROLE');
          return new GraphQLError('Doctor access required');
        }
        return true;
      }
    );

    // Rate limiting rules
    this.rateLimit = (type) => rule({ cache: 'no_cache' })(
      async (parent, args, context) => {
        try {
          await this.rateLimiters[type].consume(context.req.ip);
          return true;
        } catch (rateLimiterRes) {
          this.recordSecurityEvent('RATE_LIMIT_EXCEEDED', { type });
          return new GraphQLError(`Rate limit exceeded. Try again in ${Math.round(rateLimiterRes.msBeforeNext / 1000)} seconds`);
        }
      }
    );

    // Input validation rules
    this.validateInput = inputRule()(
      (yup) => yup.object({
        email: yup.string().email(),
        id: yup.string().uuid().nullable(),
        limit: yup.number().max(100).min(1)
      })
    );
  }

  /**
   * Create depth limiting rule
   */
  createDepthLimit(maxDepth = this.config.maxDepth) {
    return depthLimit(maxDepth, {
      onError: (error) => {
        this.stats.deepQueries++;
        this.recordSecurityEvent('DEPTH_LIMIT_EXCEEDED', { maxDepth });
        console.warn(`GraphQL depth limit exceeded: ${maxDepth}`);
      }
    });
  }

  /**
   * Create query complexity analysis (simplified)
   */
  createComplexityAnalysis(maxComplexity = this.config.maxComplexity) {
    // Simplified complexity validation based on query length
    return (context) => {
      const query = context.source;
      if (query && query.length > maxComplexity * 10) { // Simple heuristic
        this.stats.complexQueries++;
        this.recordSecurityEvent('COMPLEXITY_LIMIT_EXCEEDED', { 
          max: maxComplexity, 
          actual: Math.floor(query.length / 10)
        });
        throw new GraphQLError(
          `Query too complex. Estimated complexity exceeds ${maxComplexity}`
        );
      }
      return null;
    };
  }

  /**
   * Query whitelist validation
   */
  validateQueryWhitelist(query) {
    if (secureConfigService.get('NODE_ENV') !== 'production') {
      return true; // Allow all queries in development
    }

    const queryHash = this.hashQuery(query);
    
    if (!this.allowedQueries.has(queryHash)) {
      this.recordSecurityEvent('QUERY_NOT_WHITELISTED', { queryHash });
      throw new GraphQLError('Query not in allowed list');
    }

    return true;
  }

  /**
   * Add query to whitelist
   */
  addToWhitelist(query, description = '') {
    const queryHash = this.hashQuery(query);
    this.allowedQueries.set(queryHash, {
      query,
      description,
      addedAt: new Date(),
      usageCount: 0
    });

    console.log(`Query added to whitelist: ${description} (${queryHash})`);
    return queryHash;
  }

  /**
   * Remove query from whitelist
   */
  removeFromWhitelist(queryHash) {
    const removed = this.allowedQueries.delete(queryHash);
    if (removed) {
      console.log(`Query removed from whitelist: ${queryHash}`);
    }
    return removed;
  }

  /**
   * Hash query for whitelist comparison
   */
  hashQuery(query) {
    // Normalize query by removing whitespace and comments
    const normalized = query
      .replace(/\s+/g, ' ')
      .replace(/#.*$/gm, '')
      .trim();
    
    // Simple hash function (use crypto in production)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Validate query aliases
   */
  validateAliases(document) {
    let aliasCount = 0;
    
    // Count aliases in the query
    const countAliases = (node) => {
      if (node.alias) {
        aliasCount++;
      }
      
      if (node.selectionSet) {
        node.selectionSet.selections.forEach(countAliases);
      }
    };

    document.definitions.forEach(definition => {
      if (definition.selectionSet) {
        definition.selectionSet.selections.forEach(countAliases);
      }
    });

    if (aliasCount > this.config.maxAliases) {
      this.recordSecurityEvent('ALIAS_LIMIT_EXCEEDED', { count: aliasCount });
      throw new GraphQLError(`Too many aliases: ${aliasCount} > ${this.config.maxAliases}`);
    }

    return true;
  }

  /**
   * Validate query directives
   */
  validateDirectives(document) {
    let directiveCount = 0;
    
    const countDirectives = (node) => {
      if (node.directives) {
        directiveCount += node.directives.length;
      }
      
      if (node.selectionSet) {
        node.selectionSet.selections.forEach(countDirectives);
      }
    };

    document.definitions.forEach(definition => {
      if (definition.directives) {
        directiveCount += definition.directives.length;
      }
      
      if (definition.selectionSet) {
        definition.selectionSet.selections.forEach(countDirectives);
      }
    });

    if (directiveCount > this.config.maxDirectives) {
      this.recordSecurityEvent('DIRECTIVE_LIMIT_EXCEEDED', { count: directiveCount });
      throw new GraphQLError(`Too many directives: ${directiveCount} > ${this.config.maxDirectives}`);
    }

    return true;
  }

  /**
   * Create query timeout middleware
   */
  createQueryTimeout(timeoutMs = this.config.queryTimeoutMs) {
    return async (resolve, source, args, context, info) => {
      return Promise.race([
        resolve(source, args, context, info),
        new Promise((_, reject) => {
          setTimeout(() => {
            this.recordSecurityEvent('QUERY_TIMEOUT', { timeoutMs });
            reject(new GraphQLError(`Query timeout after ${timeoutMs}ms`));
          }, timeoutMs);
        })
      ]);
    };
  }

  /**
   * Create comprehensive security shield
   */
  createSecurityShield() {
    return shield({
      Query: {
        patients: and(this.isAuthenticated, this.isDoctor, this.rateLimit('query')),
        patient: and(this.isAuthenticated, this.isDoctor, this.rateLimit('query')),
        documents: and(this.isAuthenticated, this.rateLimit('query')),
        diagnostics: and(this.isAuthenticated, this.isDoctor, this.rateLimit('query')),
        adminStats: and(this.isAuthenticated, this.isAdmin, this.rateLimit('query'))
      },
      
      Mutation: {
        createPatient: and(this.isAuthenticated, this.isDoctor, this.rateLimit('mutation')),
        updatePatient: and(this.isAuthenticated, this.isDoctor, this.rateLimit('mutation')),
        deletePatient: and(this.isAuthenticated, this.isAdmin, this.rateLimit('mutation')),
        uploadDocument: and(this.isAuthenticated, this.rateLimit('mutation')),
        runDiagnostic: and(this.isAuthenticated, this.isDoctor, this.rateLimit('mutation'))
      }
    }, {
      allowExternalErrors: secureConfigService.get('NODE_ENV') === 'development',
      fallbackError: 'Access denied',
      fallbackRule: not(this.isAuthenticated)
    });
  }

  /**
   * Record security event
   */
  recordSecurityEvent(type, data = {}) {
    this.stats.blockedQueries++;
    
    if (!this.stats.errors.has(type)) {
      this.stats.errors.set(type, 0);
    }
    this.stats.errors.set(type, this.stats.errors.get(type) + 1);

    console.warn(`[GraphQL Security] ${type}:`, data);
    
    // In production, send to security monitoring
    // securityMonitoringService.recordEvent('graphql_security_violation', { type, ...data });
  }

  /**
   * Get security statistics
   */
  getStats() {
    return {
      ...this.stats,
      errors: Array.from(this.stats.errors.entries()).map(([type, count]) => ({
        type,
        count
      })),
      blockRate: this.stats.totalQueries > 0
        ? ((this.stats.blockedQueries / this.stats.totalQueries) * 100).toFixed(2) + '%'
        : '0%',
      whitelistedQueries: this.allowedQueries.size,
      config: this.config
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalQueries: 0,
      blockedQueries: 0,
      complexQueries: 0,
      deepQueries: 0,
      rateLimitedQueries: 0,
      errors: new Map()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('GraphQL security configuration updated:', newConfig);
  }

  /**
   * Health check for GraphQL security
   */
  healthCheck() {
    const stats = this.getStats();
    
    return {
      status: 'healthy',
      security: {
        depthLimitEnabled: this.config.maxDepth > 0,
        complexityLimitEnabled: this.config.maxComplexity > 0,
        rateLimitingEnabled: true,
        authenticationEnabled: true,
        whitelistEnabled: process.env.NODE_ENV === 'production',
        introspectionDisabled: this.config.introspectionDisabled
      },
      stats,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
module.exports = new GraphQLSecurityService();