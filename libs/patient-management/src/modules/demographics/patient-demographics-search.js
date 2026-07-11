/**
 * Patient Demographics Search Module
 * Handles searching and filtering of patient demographic data
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDemographicsSearch {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-demographics-search');
    this.initialized = true;
    console.log('✅ [PatientDemographicsSearch] Service initialized');
  }

  /**
   * Search patients by demographics criteria
   * @param {Object} searchCriteria - Search criteria
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  async searchPatientDemographics(searchCriteria, practiceContext, options = {}) {
    console.log('🔍 [PatientDemographicsSearch] Searching patient demographics');

    try {
      const query = this.buildSearchQuery(searchCriteria, practiceContext);
      const searchOptions = this.buildSearchOptions(options);

      const context = {
        serviceId: 'patient-demographics-search',
        operation: 'search-demographics',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const results = await secureDataAccess.query('patients', query, searchOptions, context);
      const totalCount = await secureDataAccess.count('patients', query, context);

      return {
        success: true,
        patients: results,
        totalCount,
        searchCriteria,
        pagination: {
          page: options.page || 1,
          limit: options.limit || 50,
          totalPages: Math.ceil(totalCount / (options.limit || 50))
        }
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsSearch] Search failed:', error);
      return {
        success: false,
        error: 'SEARCH_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Build MongoDB query from search criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} practiceContext - Practice context
   * @returns {Object} MongoDB query
   */
  buildSearchQuery(criteria, practiceContext) {
    const query = { practiceId: practiceContext.practiceId };

    // Text search across multiple fields
    if (criteria.text) {
      query.$or = [
        { firstName: { $regex: criteria.text, $options: 'i' } },
        { lastName: { $regex: criteria.text, $options: 'i' } },
        { email: { $regex: criteria.text, $options: 'i' } }
      ];
    }

    // Age range search
    if (criteria.ageMin || criteria.ageMax) {
      const now = new Date();
      if (criteria.ageMin) {
        const maxDate = new Date(now.getFullYear() - criteria.ageMin, now.getMonth(), now.getDate());
        query.dateOfBirth = { ...query.dateOfBirth, $lte: maxDate };
      }
      if (criteria.ageMax) {
        const minDate = new Date(now.getFullYear() - criteria.ageMax - 1, now.getMonth(), now.getDate());
        query.dateOfBirth = { ...query.dateOfBirth, $gte: minDate };
      }
    }

    // Gender filter
    if (criteria.gender) {
      query.gender = criteria.gender;
    }

    // City filter
    if (criteria.city) {
      query.city = { $regex: criteria.city, $options: 'i' };
    }

    // State filter
    if (criteria.state) {
      query.state = criteria.state;
    }

    // ZIP code filter
    if (criteria.zipCode) {
      query.zipCode = criteria.zipCode;
    }

    return query;
  }

  /**
   * Build search options for MongoDB query
   * @param {Object} options - Search options
   * @returns {Object} MongoDB options
   */
  buildSearchOptions(options) {
    const searchOptions = {
      limit: options.limit || 50,
      skip: ((options.page || 1) - 1) * (options.limit || 50)
    };

    // Sorting
    if (options.sortBy) {
      searchOptions.sort = { [options.sortBy]: options.sortOrder === 'desc' ? -1 : 1 };
    } else {
      searchOptions.sort = { lastName: 1, firstName: 1 }; // Default sort
    }

    return searchOptions;
  }

  /**
   * Advanced search with multiple criteria
   * @param {Object} criteria - Advanced search criteria
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Search results
   */
  async advancedDemographicsSearch(criteria, practiceContext) {
    const aggregationPipeline = [
      { $match: { practiceId: practiceContext.practiceId } }
    ];

    // Add demographic filters
    if (criteria.demographics) {
      const demographicMatch = {};
      
      if (criteria.demographics.ageRange) {
        // Calculate date range for age
        const now = new Date();
        const minDate = new Date(now.getFullYear() - criteria.demographics.ageRange.max - 1, 0, 1);
        const maxDate = new Date(now.getFullYear() - criteria.demographics.ageRange.min, 11, 31);
        demographicMatch.dateOfBirth = { $gte: minDate, $lte: maxDate };
      }

      if (criteria.demographics.gender) {
        demographicMatch.gender = { $in: criteria.demographics.gender };
      }

      if (Object.keys(demographicMatch).length > 0) {
        aggregationPipeline.push({ $match: demographicMatch });
      }
    }

    // Add geographic filters
    if (criteria.geography) {
      const geoMatch = {};
      if (criteria.geography.states) {
        geoMatch.state = { $in: criteria.geography.states };
      }
      if (criteria.geography.cities) {
        geoMatch.city = { $in: criteria.geography.cities };
      }
      if (Object.keys(geoMatch).length > 0) {
        aggregationPipeline.push({ $match: geoMatch });
      }
    }

    // Add sorting and pagination
    if (criteria.sort) {
      aggregationPipeline.push({ $sort: criteria.sort });
    }

    if (criteria.limit) {
      aggregationPipeline.push({ $limit: criteria.limit });
    }

    try {
      const context = {
        serviceId: 'patient-demographics-search',
        operation: 'advanced-search',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      // Note: This would use aggregation pipeline in a full implementation
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const results = await secureDataAccess.query('patients', aggregationPipeline[0].$match, {}, context);

      return {
        success: true,
        patients: results,
        totalCount: results.length,
        criteria
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsSearch] Advanced search failed:', error);
      return {
        success: false,
        error: 'ADVANCED_SEARCH_FAILED',
        message: error.message
      };
    }
  }
}

const patientDemographicsSearch = new PatientDemographicsSearch();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDemographicsSearch', () => patientDemographicsSearch);
}

module.exports = patientDemographicsSearch;