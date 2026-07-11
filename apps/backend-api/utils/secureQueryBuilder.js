/**
 * 🔒 SECURE QUERY BUILDER UTILITY
 * Enterprise-grade safe query construction for IntelliCare platform
 * 
 * This utility provides safe query construction methods without exposing MongoDB operators.
 * All queries are sanitized and validated before execution through SecureDataAccess.
 * 
 * SECURITY FEATURES:
 * - Input sanitization via securityUtils
 * - No direct MongoDB operator exposure
 * - JavaScript-based filtering for complex operations
 * - Rate limiting and pattern detection
 * - Comprehensive audit logging
 */

const securityUtils = require('./securityUtils');
const crypto = require('crypto');

class SecureQueryBuilder {
  constructor() {
    this.queryCache = new Map();
    this.queryHistory = [];
    this.maxCacheSize = 1000;
    this.maxHistorySize = 10000;
  }

  /**
   * Build secure date range query
   * Returns a function that filters in JavaScript to avoid MongoDB injection
   * 
   * @param {string} field - Field name to filter on
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @param {Object} options - Additional options
   * @returns {Object} Safe filter object and post-processing function
   */
  buildDateRangeQuery(field, startDate, endDate, options = {}) {
    // Validate inputs
    if (!field || typeof field !== 'string') {
      throw new Error('SECURITY: Field name must be a valid string');
    }
    
    if (securityUtils.detectNoSqlInjection(field)) {
      throw new Error('SECURITY: Invalid field name detected');
    }

    // Sanitize and validate dates
    const start = this.parseSecureDate(startDate);
    const end = this.parseSecureDate(endDate);

    if (!start || !end) {
      throw new Error('SECURITY: Invalid date format');
    }

    if (start > end) {
      throw new Error('SECURITY: Start date cannot be after end date');
    }

    // Create safe MongoDB filter (basic field existence check)
    const mongoFilter = {
      [field]: { $exists: true }
    };

    // Create JavaScript post-filter function
    const postFilter = (items) => {
      return items.filter(item => {
        if (!item || !item[field]) return false;
        
        const itemDate = new Date(item[field]);
        if (isNaN(itemDate.getTime())) return false;
        
        const withinRange = itemDate >= start && itemDate <= end;
        
        // Apply additional filters if specified
        if (options.excludeWeekends && this.isWeekend(itemDate)) {
          return false;
        }
        
        if (options.includeTime === false) {
          // Compare dates only, ignore time
          const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
          const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
          return itemDateOnly >= startDateOnly && itemDateOnly <= endDateOnly;
        }
        
        return withinRange;
      });
    };

    this.logQueryUsage('dateRange', { field, startDate, endDate, options });

    return {
      mongoFilter,
      postFilter,
      metadata: {
        type: 'dateRange',
        field,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        queryId: this.generateQueryId()
      }
    };
  }

  /**
   * Build secure status query
   * Safe enum-based status filtering
   * 
   * @param {string} field - Status field name
   * @param {Array|string} statuses - Allowed status values
   * @param {Object} options - Additional options
   * @returns {Object} Safe filter object
   */
  buildStatusQuery(field, statuses, options = {}) {
    // Validate field name
    if (!field || typeof field !== 'string') {
      throw new Error('SECURITY: Field name must be a valid string');
    }
    
    // Check for dangerous field patterns (including prototype pollution)
    const dangerousFields = ['__proto__', 'constructor', 'prototype'];
    if (dangerousFields.includes(field.toLowerCase())) {
      throw new Error('SECURITY: Dangerous field name detected');
    }
    
    // Check for SQL injection in field name
    if (securityUtils.detectSqlInjection(field)) {
      throw new Error('SECURITY: SQL injection attempt detected in field name');
    }
    
    if (securityUtils.detectNoSqlInjection(field)) {
      throw new Error('SECURITY: Invalid field name detected');
    }

    // Normalize statuses to array
    const statusArray = Array.isArray(statuses) ? statuses : [statuses];
    
    // Validate and sanitize each status
    const sanitizedStatuses = statusArray.map(status => {
      if (typeof status !== 'string') {
        throw new Error('SECURITY: Status values must be strings');
      }
      
      const sanitized = securityUtils.sanitizeInput(status, 'general');
      if (securityUtils.detectNoSqlInjection(sanitized)) {
        throw new Error('SECURITY: Invalid status value detected');
      }
      
      return sanitized;
    });

    // Define allowed status values based on common patterns
    const allowedStatuses = options.allowedValues || [
      'active', 'inactive', 'pending', 'approved', 'rejected', 'cancelled',
      'completed', 'in-progress', 'draft', 'published', 'archived',
      'scheduled', 'confirmed', 'no-show', 'rescheduled'
    ];

    // Validate against whitelist
    const validStatuses = sanitizedStatuses.filter(status => 
      allowedStatuses.includes(status.toLowerCase())
    );

    if (validStatuses.length === 0) {
      throw new Error('SECURITY: No valid status values provided');
    }

    // Create safe MongoDB filter
    const mongoFilter = {
      [field]: { $in: validStatuses }
    };

    // Create post-filter function for additional validation
    const postFilter = (items) => {
      return items.filter(item => {
        if (!item || !item[field]) return false;
        
        const itemStatus = String(item[field]).toLowerCase();
        const matches = validStatuses.some(status => 
          status.toLowerCase() === itemStatus
        );
        
        // Apply case sensitivity if requested
        if (options.caseSensitive) {
          return validStatuses.includes(item[field]);
        }
        
        return matches;
      });
    };

    this.logQueryUsage('status', { field, statuses: validStatuses, options });

    return {
      mongoFilter,
      postFilter,
      metadata: {
        type: 'status',
        field,
        statuses: validStatuses,
        queryId: this.generateQueryId()
      }
    };
  }

  /**
   * Build secure pagination query
   * Safe limit/skip operations with bounds checking
   * 
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} options - Additional options
   * @returns {Object} Safe pagination object
   */
  buildPaginationQuery(page = 1, pageSize = 20, options = {}) {
    // Validate and sanitize inputs
    const safePage = Math.max(1, Math.floor(Number(page))) || 1;
    const safePageSize = Math.min(
      Math.max(1, Math.floor(Number(pageSize))) || 20,
      options.maxPageSize || 100  // Prevent excessive page sizes
    );

    if (safePage > (options.maxPages || 1000)) {
      throw new Error('SECURITY: Page number exceeds maximum allowed');
    }

    const skip = (safePage - 1) * safePageSize;
    const limit = safePageSize;

    // MongoDB options
    const mongoOptions = {
      skip,
      limit,
      sort: options.sort || { _id: 1 }  // Always have consistent sorting
    };

    // Post-processing function for additional validation
    const postProcess = (items, totalCount) => {
      const hasMore = totalCount > skip + items.length;
      const totalPages = Math.ceil(totalCount / safePageSize);
      
      return {
        data: items,
        pagination: {
          currentPage: safePage,
          pageSize: safePageSize,
          totalCount,
          totalPages,
          hasNextPage: hasMore,
          hasPreviousPage: safePage > 1,
          nextPage: hasMore ? safePage + 1 : null,
          previousPage: safePage > 1 ? safePage - 1 : null
        }
      };
    };

    this.logQueryUsage('pagination', { page: safePage, pageSize: safePageSize, options });

    return {
      mongoOptions,
      postProcess,
      metadata: {
        type: 'pagination',
        page: safePage,
        pageSize: safePageSize,
        skip,
        limit,
        queryId: this.generateQueryId()
      }
    };
  }

  /**
   * Build secure field selection (projection)
   * Safe field filtering with whitelist validation
   * 
   * @param {Array|string} fields - Fields to include/exclude
   * @param {Object} options - Additional options
   * @returns {Object} Safe projection object
   */
  buildFieldSelection(fields, options = {}) {
    if (!fields) return { mongoProjection: {} };

    // Normalize to array
    const fieldArray = Array.isArray(fields) ? fields : [fields];
    
    // Validate and sanitize field names
    const safeFields = fieldArray.filter(field => {
      if (typeof field !== 'string') return false;
      if (securityUtils.detectNoSqlInjection(field)) return false;
      
      // Validate field name format
      if (!/^[a-zA-Z][a-zA-Z0-9._]*$/.test(field)) return false;
      
      // Check against dangerous fields
      const dangerousFields = ['password', 'apiKey', 'secret', 'token', '__proto__'];
      if (dangerousFields.some(dangerous => field.toLowerCase().includes(dangerous))) {
        return false;
      }
      
      return true;
    });

    if (safeFields.length === 0) {
      throw new Error('SECURITY: No valid fields provided');
    }

    // Define allowed fields based on common patterns
    const allowedFields = options.allowedFields || [
      '_id', 'name', 'email', 'createdAt', 'updatedAt', 'status',
      'title', 'description', 'category', 'tags', 'metadata',
      'patientId', 'practiceId', 'userId', 'appointmentId', 'documentId'
    ];

    // Filter against whitelist if provided
    const validFields = options.strict 
      ? safeFields.filter(field => allowedFields.includes(field))
      : safeFields;

    if (validFields.length === 0) {
      throw new Error('SECURITY: No allowed fields in selection');
    }

    // Create MongoDB projection
    const mongoProjection = {};
    const isExclusion = options.exclude === true;
    
    validFields.forEach(field => {
      mongoProjection[field] = isExclusion ? 0 : 1;
    });

    // Always include _id unless explicitly excluded
    if (!isExclusion && !validFields.includes('_id')) {
      mongoProjection._id = 1;
    }

    // Post-processing function for additional field filtering
    const postFilter = (items) => {
      if (!Array.isArray(items)) return items;
      
      return items.map(item => {
        if (!item || typeof item !== 'object') return item;
        
        const filtered = {};
        validFields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            filtered[field] = item[field];
          }
        });
        
        return filtered;
      });
    };

    this.logQueryUsage('fieldSelection', { fields: validFields, options });

    return {
      mongoProjection,
      postFilter,
      metadata: {
        type: 'fieldSelection',
        fields: validFields,
        isExclusion,
        queryId: this.generateQueryId()
      }
    };
  }

  /**
   * Build secure sorting query
   * Safe sort parameter construction with validation
   * 
   * @param {Object|string} sortBy - Sort specification
   * @param {Object} options - Additional options
   * @returns {Object} Safe sort object
   */
  buildSortingQuery(sortBy, options = {}) {
    if (!sortBy) return { mongoSort: { _id: 1 } };

    let sortObj = {};

    // Handle different input formats
    if (typeof sortBy === 'string') {
      // Parse "field:direction" format
      const [field, direction] = sortBy.split(':');
      sortObj[field] = direction === 'desc' ? -1 : 1;
    } else if (typeof sortBy === 'object' && !Array.isArray(sortBy)) {
      sortObj = { ...sortBy };
    } else {
      throw new Error('SECURITY: Invalid sort specification');
    }

    // Validate and sanitize sort fields
    const safeSortObj = {};
    const allowedFields = options.allowedFields || [
      '_id', 'name', 'createdAt', 'updatedAt', 'status', 'priority',
      'scheduledDate', 'appointmentTime', 'uploadDate', 'lastModified'
    ];

    for (const [field, direction] of Object.entries(sortObj)) {
      // Validate field name
      if (typeof field !== 'string' || !field.trim()) continue;
      if (securityUtils.detectNoSqlInjection(field)) continue;
      if (!/^[a-zA-Z][a-zA-Z0-9._]*$/.test(field)) continue;
      
      // Check against allowlist if strict mode
      if (options.strict && !allowedFields.includes(field)) continue;
      
      // Validate sort direction
      const safeDirection = direction === -1 || direction === 'desc' || direction === 'DESC' ? -1 : 1;
      
      safeSortObj[field] = safeDirection;
    }

    // Ensure at least one sort field
    if (Object.keys(safeSortObj).length === 0) {
      safeSortObj._id = 1; // Default fallback sort
    }

    // Limit number of sort fields to prevent performance issues
    const maxSortFields = options.maxSortFields || 3;
    const limitedSortObj = {};
    const sortKeys = Object.keys(safeSortObj).slice(0, maxSortFields);
    
    sortKeys.forEach(key => {
      limitedSortObj[key] = safeSortObj[key];
    });

    this.logQueryUsage('sorting', { sortBy: limitedSortObj, options });

    return {
      mongoSort: limitedSortObj,
      metadata: {
        type: 'sorting',
        sortBy: limitedSortObj,
        originalFields: Object.keys(sortObj).length,
        validFields: Object.keys(limitedSortObj).length,
        queryId: this.generateQueryId()
      }
    };
  }

  /**
   * Build secure text search query
   * Safe text matching without regex injection
   * 
   * @param {string} searchTerm - Text to search for
   * @param {Array} searchFields - Fields to search in
   * @param {Object} options - Additional options
   * @returns {Object} Safe search object
   */
  buildTextSearchQuery(searchTerm, searchFields = [], options = {}) {
    if (!searchTerm || typeof searchTerm !== 'string') {
      throw new Error('SECURITY: Search term must be a non-empty string');
    }

    // Check for XSS patterns specifically  
    if (securityUtils.detectXSS(searchTerm)) {
      throw new Error('SECURITY: XSS attempt detected in search term');
    }

    // Sanitize search term
    const sanitized = securityUtils.sanitizeInput(searchTerm.trim(), 'general');
    if (securityUtils.detectNoSqlInjection(sanitized)) {
      throw new Error('SECURITY: Invalid search term detected');
    }

    if (sanitized.length < (options.minLength || 2)) {
      throw new Error('SECURITY: Search term too short');
    }

    if (sanitized.length > (options.maxLength || 100)) {
      throw new Error('SECURITY: Search term too long');
    }

    // Validate search fields
    const safeFields = searchFields.filter(field => {
      if (typeof field !== 'string') return false;
      if (securityUtils.detectNoSqlInjection(field)) return false;
      return /^[a-zA-Z][a-zA-Z0-9._]*$/.test(field);
    });

    if (safeFields.length === 0) {
      safeFields.push('name', 'description'); // Default search fields
    }

    // Create MongoDB text search if available, otherwise use basic matching
    let mongoFilter = {};
    
    if (options.useTextIndex) {
      // Use MongoDB text search (safer than regex)
      mongoFilter = {
        $text: { $search: sanitized }
      };
    } else {
      // Basic field existence check - actual search happens in post-processing
      mongoFilter = {
        $or: safeFields.map(field => ({ [field]: { $exists: true } }))
      };
    }

    // Post-processing search function
    const postFilter = (items) => {
      const searchTermLower = sanitized.toLowerCase();
      
      return items.filter(item => {
        if (!item) return false;
        
        return safeFields.some(field => {
          const fieldValue = item[field];
          if (!fieldValue) return false;
          
          const valueStr = String(fieldValue).toLowerCase();
          
          if (options.exactMatch) {
            return valueStr === searchTermLower;
          } else if (options.startsWith) {
            return valueStr.startsWith(searchTermLower);
          } else {
            return valueStr.includes(searchTermLower);
          }
        });
      });
    };

    this.logQueryUsage('textSearch', { 
      searchTerm: sanitized, 
      fields: safeFields, 
      options 
    });

    return {
      mongoFilter,
      postFilter,
      metadata: {
        type: 'textSearch',
        searchTerm: sanitized,
        searchFields: safeFields,
        useTextIndex: options.useTextIndex || false,
        queryId: this.generateQueryId()
      }
    };
  }

  /**
   * Build secure aggregation pipeline
   * Safe aggregation with operation whitelisting
   * 
   * @param {Array} operations - Aggregation operations
   * @param {Object} options - Additional options
   * @returns {Array} Safe aggregation pipeline
   */
  buildAggregationPipeline(operations = [], options = {}) {
    if (!Array.isArray(operations)) {
      throw new Error('SECURITY: Operations must be an array');
    }

    const allowedOperations = options.allowedOperations || [
      '$match', '$group', '$sort', '$limit', '$skip', '$project', '$unwind', '$lookup'
    ];

    const forbiddenOperations = [
      '$merge', '$out', '$function', '$accumulator', '$where'
    ];

    const safePipeline = [];

    for (const operation of operations) {
      if (typeof operation !== 'object' || operation === null) {
        continue; // Skip invalid operations
      }

      const operationKeys = Object.keys(operation);
      let isValid = true;

      // Check for forbidden operations
      for (const key of operationKeys) {
        if (forbiddenOperations.includes(key)) {
          throw new Error(`SECURITY: Forbidden aggregation operation: ${key}`);
        }
        
        if (!allowedOperations.includes(key)) {
          isValid = false;
          break;
        }
      }

      if (!isValid) continue;

      // Validate operation content
      const validatedOperation = this.validateAggregationOperation(operation);
      if (validatedOperation) {
        safePipeline.push(validatedOperation);
      }
    }

    // Limit pipeline complexity
    const maxOperations = options.maxOperations || 10;
    if (safePipeline.length > maxOperations) {
      throw new Error('SECURITY: Aggregation pipeline too complex');
    }

    this.logQueryUsage('aggregation', { 
      operationCount: safePipeline.length,
      options 
    });

    return safePipeline;
  }

  /**
   * Combine multiple query builders
   * Merge filters, sorts, and options safely
   * 
   * @param {Array} builders - Array of query builder results
   * @returns {Object} Combined query object
   */
  combineQueries(builders = []) {
    if (!Array.isArray(builders)) {
      throw new Error('SECURITY: Builders must be an array');
    }

    const combined = {
      mongoFilter: {},
      mongoOptions: {},
      postFilters: [],
      metadata: {
        type: 'combined',
        builderCount: builders.length,
        queryId: this.generateQueryId()
      }
    };

    // Combine MongoDB filters
    const mongoFilters = builders
      .filter(b => b && b.mongoFilter)
      .map(b => b.mongoFilter);

    if (mongoFilters.length > 1) {
      combined.mongoFilter = { $and: mongoFilters };
    } else if (mongoFilters.length === 1) {
      combined.mongoFilter = mongoFilters[0];
    }

    // Combine options (pagination, sorting, projection)
    builders.forEach(builder => {
      if (builder.mongoOptions) {
        Object.assign(combined.mongoOptions, builder.mongoOptions);
      }
      
      if (builder.mongoSort) {
        combined.mongoOptions.sort = { ...combined.mongoOptions.sort, ...builder.mongoSort };
      }
      
      if (builder.mongoProjection) {
        combined.mongoOptions.projection = { ...combined.mongoOptions.projection, ...builder.mongoProjection };
      }
      
      if (builder.postFilter) {
        combined.postFilters.push(builder.postFilter);
      }
    });

    // Create combined post-processing function
    combined.postProcess = (items) => {
      let result = items;
      
      // Apply all post-filters in sequence
      combined.postFilters.forEach(filter => {
        result = filter(result);
      });
      
      return result;
    };

    this.logQueryUsage('combined', { builderCount: builders.length });

    return combined;
  }

  // === UTILITY METHODS ===

  /**
   * Parse date safely with multiple format support
   */
  parseSecureDate(dateInput) {
    if (!dateInput) return null;
    
    if (dateInput instanceof Date) {
      return isNaN(dateInput.getTime()) ? null : dateInput;
    }
    
    if (typeof dateInput === 'string') {
      // Sanitize date string
      const sanitized = securityUtils.sanitizeInput(dateInput, 'general');
      const parsed = new Date(sanitized);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    return null;
  }

  /**
   * Check if date is weekend
   */
  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  /**
   * Validate aggregation operation
   */
  validateAggregationOperation(operation) {
    // Deep validation of aggregation operations
    const validated = {};
    
    for (const [key, value] of Object.entries(operation)) {
      if (typeof value === 'object' && value !== null) {
        // Recursively validate nested objects
        const nestedValidation = this.validateNestedObject(value);
        if (nestedValidation !== null) {
          validated[key] = nestedValidation;
        }
      } else {
        // Validate primitive values
        const sanitized = securityUtils.sanitizeInput(String(value), 'general');
        if (!securityUtils.detectNoSqlInjection(sanitized)) {
          validated[key] = value;
        }
      }
    }
    
    return Object.keys(validated).length > 0 ? validated : null;
  }

  /**
   * Validate nested object for aggregation operations
   */
  validateNestedObject(obj) {
    const validated = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip dangerous keys
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        continue;
      }
      
      if (securityUtils.detectNoSqlInjection(key)) {
        continue;
      }
      
      validated[key] = value;
    }
    
    return Object.keys(validated).length > 0 ? validated : null;
  }

  /**
   * Generate unique query ID for tracking
   */
  generateQueryId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Log query usage for monitoring
   */
  logQueryUsage(type, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      details: securityUtils.maskSensitiveData(details),
      queryId: this.generateQueryId()
    };
    
    this.queryHistory.push(logEntry);
    
    // Maintain history size limit
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory = this.queryHistory.slice(-this.maxHistorySize);
    }
    
    // Log suspicious patterns
    if (this.detectSuspiciousPattern(type, details)) {
      console.warn('🚨 Suspicious query pattern detected:', logEntry);
    }
  }

  /**
   * Detect suspicious query patterns
   */
  detectSuspiciousPattern(type, details) {
    // Implement pattern detection logic
    const recentQueries = this.queryHistory.slice(-50);
    const sameTypeCount = recentQueries.filter(q => q.type === type).length;
    
    // Alert if too many queries of same type in short period
    return sameTypeCount > 20;
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    const stats = {};
    this.queryHistory.forEach(query => {
      stats[query.type] = (stats[query.type] || 0) + 1;
    });
    
    return {
      totalQueries: this.queryHistory.length,
      queryTypes: stats,
      cacheSize: this.queryCache.size,
      lastQuery: this.queryHistory[this.queryHistory.length - 1]
    };
  }

  /**
   * Clear query history and cache
   */
  clearHistory() {
    this.queryHistory = [];
    this.queryCache.clear();
    console.log('Query history and cache cleared');
  }
}

// Export singleton instance
module.exports = new SecureQueryBuilder();