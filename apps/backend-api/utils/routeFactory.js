/**
 * Route Factory
 * Helper functions for creating medical data routes
 */

const asyncHandler = require('./asyncHandler');
const { rateLimit } = require('express-rate-limit');

// General API Rate Limiting - 100 requests per minute
const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      en: 'Too many requests, please try again later',
      he: 'יותר מדי בקשות, אנא נסה שוב מאוחר יותר'
    }
  }
});

/**
 * Create a medical data route handler
 * @param {string} category - Medical data category (collection name)
 * @param {string} functionName - Optional specialized function name in agentServiceV4
 * @param {string} permission - Required permission for this route
 * @returns {Function} Express route handler
 */
const createMedicalDataRoute = (category, functionName, permission) => {
  return asyncHandler(async (req, res) => {
    try {
      const { patientId } = req.params;
      const queryParams = req.query || {};
      const rawMode = queryParams.raw === 'true'; // Skip grid formatting for document mode

      console.log(`🏥 [${category}] Fetching for patient ${patientId} (raw: ${rawMode})`);
      console.log(`🔍 [${category}] Full URL: ${req.originalUrl}`);
      console.log(`🔍 [${category}] req.params:`, req.params);

      // Import services
      const agentServiceV4 = require('../services/agentServiceV4');
      const medicalDataService = require('../services/medicalDataService');
      const gridLoader = require('../services/gridMappings/gridLoader');
      const { ObjectId } = require('mongodb');

      // Build security context
      const context = {
        serviceId: 'agent-routes',
        operation: category,
        practiceId: req.practice?.id || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // If specialized function exists and is using SecureDataAccess, call it
      // Otherwise use generic medical data service
      let result;

      if (functionName && agentServiceV4[functionName]) {
        // Call specialized function
        result = await agentServiceV4[functionName](
          { patientId, ...queryParams },
          req.practiceContext,
          req.session
        );

        // Check if this is a document mode collection
        const { isDocumentMode } = require('../services/gridMappings/collectionDisplayConfig');

        // Format result with grid loader if data exists (unless raw mode or document mode)
        if (result.success && result.data && result.data.length > 0 && !rawMode && !isDocumentMode(category)) {
          // Initialize medicalDataService if needed (for API key)
          if (!medicalDataService.initialized) {
            await medicalDataService.initialize(context);
          }

          // Build context with API key for grid mapper (specialized function path)
          const gridContext = {
            ...context,
            serviceId: 'medical-data-service',
            apiKey: medicalDataService.serviceToken || context.apiKey
          };

          console.log(`🔍 [${category}] SPECIALIZED PATH - gridContext has apiKey:`, !!gridContext.apiKey);

          const gridConfig = await gridLoader.getGridConfig(category, result.data, gridContext);

          console.log(`🔍 [${category}] SPECIALIZED - gridConfig keys:`, Object.keys(gridConfig || {}));
          console.log(`🔍 [${category}] SPECIALIZED - gridConfig.data length:`, gridConfig?.data?.length);

          if (gridConfig) {
            result = {
              ...result,
              ...gridConfig
            };
          }
        }
      } else {
        // Use generic medical data service
        const patientIdObj = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId;

        // Initialize medicalDataService if needed
        if (!medicalDataService.initialized) {
          await medicalDataService.initialize(context);
        }

        // Get data from collection
        const data = await medicalDataService.getMedicalData(category, patientIdObj, {}, context);

        if (!data || data.length === 0) {
          return res.json({
            success: true,
            data: [],
            count: 0,
            message: `No ${category} data found`
          });
        }

        // Check if this is a document mode collection
        const { isDocumentMode } = require('../services/gridMappings/collectionDisplayConfig');

        // If raw mode OR document mode collection, return data without grid formatting
        if (rawMode || isDocumentMode(category)) {
          result = {
            success: true,
            data: data,
            count: data.length
          };
        } else {
          // Build context with API key for grid mapper
          const gridContext = {
            ...context,
            serviceId: 'medical-data-service',
            apiKey: medicalDataService.serviceToken
          };

          // Format with grid loader
          const gridConfig = await gridLoader.getGridConfig(category, data, gridContext);

          if (!gridConfig) {
            return res.status(500).json({
              success: false,
              error: `No grid configuration found for category: ${category}`
            });
          }

          console.log(`🔍 [${category}] gridConfig keys:`, Object.keys(gridConfig));
          console.log(`🔍 [${category}] gridConfig.data length:`, gridConfig.data?.length);

          result = {
            success: true,
            ...gridConfig,
            count: data.length
          };
        }
      }

      console.log(`✅ [${category}] Returning ${result.data?.length || 0} records`);
      return res.json(result);

    } catch (error) {
      console.error(`❌ [${category}] Error:`, error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};

/**
 * Create a document data route handler (returns raw nested data, no grid formatting)
 * @param {string} category - Medical data category (collection name with underscores)
 * @param {string} permission - Required permission for this route
 * @returns {Function} Express route handler
 */
const createDocumentDataRoute = (category, permission) => {
  return asyncHandler(async (req, res) => {
    try {
      const { patientId } = req.params;

      console.log(`📄 [${category}] Fetching document data for patient ${patientId}`);

      // Import services
      const medicalDataService = require('../services/medicalDataService');
      const { ObjectId } = require('mongodb');

      // Build security context
      const context = {
        serviceId: 'agent-routes',
        operation: category,
        practiceId: req.practice?.id || 'global',
        practiceSubdomain: req.practice?.subdomain || req.practiceContext?.subdomain,
        sessionId: req.sessionID
      };

      // Convert patientId to ObjectId if needed
      const patientIdObj = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
        ? new ObjectId(patientId)
        : patientId;

      // Initialize medicalDataService if needed
      if (!medicalDataService.initialized) {
        await medicalDataService.initialize(context);
      }

      // Get raw data from collection (no grid formatting)
      const data = await medicalDataService.getMedicalData(category, patientIdObj, {}, context);

      if (!data || data.length === 0) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: `No ${category} data found`
        });
      }

      // Return raw data without grid formatting
      console.log(`✅ [${category}] Returning ${data.length} raw document records`);
      return res.json({
        success: true,
        data: data,
        count: data.length
      });

    } catch (error) {
      console.error(`❌ [${category}] Error:`, error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};

module.exports = {
  createMedicalDataRoute,
  createDocumentDataRoute,
  generalRateLimit
};
