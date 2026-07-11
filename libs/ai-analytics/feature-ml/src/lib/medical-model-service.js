/**
 * Medical Model Service
 * This service interfaces with various open-source medical models
 * Note: Some models like MedGemma with image-text-to-text require the transformers library 
 * and huggingface-cli login rather than the Inference API endpoint
 */

const http = require('http');
const axios = require('axios');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * @class MedicalModelService
 * @description Service class for interfacing with medical AI models
 */

class MedicalModelService {
  constructor() {
    this.initialized = false;
    this.models = {
      medgemma: {
        key: 'medgemma',
        name: 'MedGemma',
        version: '4B-IT',
        description: 'Google\'s MedGemma medical language model with multilingual support',
        type: 'microservice'
      }
    };
    
    // Microservice configuration - will be set during initialization
    this.microserviceUrl = null;
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const secureConfigService = proxy.getService('secureConfigService');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('medical-model-service');
      
      // Initialize secure config service
      await secureConfigService.initialize();
      
      // Configure microservice URL
      this.microserviceUrl = secureConfigService.get('MEDGEMMA_SERVICE_URL') || 'http://localhost:5001';
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const auditContext = {
        serviceId: 'medical-model-service',
        operation: 'SERVICE_INITIALIZED',
        practiceId: 'global'
      };
      
      try {
        const secureDataAccess = proxy.getService('secureDataAccess');
        await secureDataAccess.create('audit_logs', {
          action: 'SERVICE_INITIALIZED',
          service: 'medicalModelService',
          timestamp: new Date()
        }, auditContext);
      } catch (auditError) {
        console.warn('Failed to log service initialization:', auditError.message);
      }
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize MedicalModelService: ${error.message}`);
    }
  }


  /**
   * Predict diagnosis based on symptoms using a single comprehensive request
   * @param {Object} params - Patient information
   * @param {string} params.symptoms - Patient's symptoms
   * @param {number} [params.age] - Patient's age (optional)
   * @param {string} [params.gender] - Patient's gender (optional)
   * @param {string} [params.additionalInfo] - Additional patient information (optional)
   * @returns {Promise<Object>} Comprehensive diagnosis with recommendations from all models
   */
  async predictDiagnosis(params) {
    // Validate input parameters
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid parameters provided. Expected an object.');
    }
    
    if (!params.symptoms || typeof params.symptoms !== 'string') {
      throw new Error('Symptoms must be provided as a string');
    }
    
    // Sanitize input - preserve Hebrew characters and remove only truly dangerous characters
    params.symptoms = params.symptoms.replace(/[<>{}[\]\\]/g, '');
    
    // Add request metadata
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    
    params.requestMetadata = {
      receivedAt: new Date().toISOString(),
      // 🔒 SECURITY: No fallbacks - environment must be explicitly set
      environment: secureConfigService.get('NODE_ENV') || (() => { throw new Error('NODE_ENV must be explicitly set - no fallbacks allowed'); })()
    };
    
    const allModels = await this.getAvailableModels();
    const modelResults = [];

    for (const model of allModels) {
      console.log(`Processing model: ${model.name}`);
      
      try {
        // Get comprehensive diagnosis with recommendations from the model
        let result;
        switch (model.type) {
          case 'microservice':
            console.log(`Getting comprehensive diagnosis from ${model.name}...`);
            result = await this._callMicroserviceModel(params, model.key);
            break;

          default:
            throw new Error(`Unsupported model type: ${model.type}`);
        }

        modelResults.push({
          model: model.name,
          prediction: result.prediction,
          confidence: result.confidence,
          recommendations: result.recommendations || [],
          riskLevel: result.riskLevel
        });

      } catch (error) {
        console.error(`Failed to process model ${model.name}:`, error.message);
        // Skip this model and continue with others
        // If all models fail, the summary will handle empty results
        continue;
      }
    }

    // Check if we got any results
    if (modelResults.length === 0) {
      throw new Error('All medical models failed to provide diagnosis. Please check model services.');
    }

    // Summarize the results
    const summary = this._summarizeResults(modelResults);

    return summary;
  }

  /**
   * Summarize the results from all models
   * @private
   * @param {Array} modelResults - Results from all models
   * @returns {Object} Summarized diagnosis prediction
   */
  _summarizeResults(modelResults) {
    let overallPrediction = '';
    let averageConfidence = 0;
    let combinedRecommendations = [];
    let highestRiskLevel = 'LOW';

    for (const result of modelResults) {
      overallPrediction += `${result.model}: ${result.prediction}\n`;
      averageConfidence += result.confidence;
      combinedRecommendations = [...combinedRecommendations, ...result.recommendations];

      if (result.riskLevel === 'HIGH') {
        highestRiskLevel = 'HIGH';
      } else if (result.riskLevel === 'MEDIUM' && highestRiskLevel !== 'HIGH') {
        highestRiskLevel = 'MEDIUM';
      }
    }

    averageConfidence /= modelResults.length;
    combinedRecommendations = [...new Set(combinedRecommendations)]; // Remove duplicates

    return {
      overallPrediction,
      averageConfidence,
      combinedRecommendations,
      highestRiskLevel,
      modelResults, // Include individual model results for reference
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get available medical models
   * @returns {Array} List of available models
   */
  async getAvailableModels() {
    return [this.models.medgemma];
  }

  /**
   * Stop ongoing diagnosis process
   * @returns {Object} Stop result
   */
  async stopDiagnosis() {
    console.log('🛑 Stopping diagnosis process...');
    
    try {
      // Send stop signal to MediGemma microservice
      const stopResponse = await axios.post(`${this.microserviceUrl}/stop`, {}, {
        timeout: 5000,
        validateStatus: status => status >= 200 && status < 500 // Accept 4xx as valid response
      });
      
      console.log('✅ Stop signal sent to MediGemma microservice');
      return {
        success: true,
        message: 'Diagnosis process stopped',
        microserviceResponse: stopResponse.data
      };
    } catch (error) {
      console.error('⚠️ Error stopping microservice:', error.message);
      
      // Even if microservice stop fails, we consider it a success
      // because the frontend request will be aborted anyway
      return {
        success: true,
        message: 'Diagnosis process stopped (frontend)',
        warning: 'Could not communicate with microservice'
      };
    }
  }

  /**
   * Get diagnosis status and completed results if available
   * @returns {Object} Status result
   */
  async getDiagnosisStatus() {
    try {
      // Check status from MediGemma microservice with reduced logging
      const statusResponse = await axios.get(`${this.microserviceUrl}/status`, {
        timeout: 5000,
        validateStatus: status => status >= 200 && status < 500 // Accept 4xx as valid response
      });
      
      // If diagnosis is completed and has results, format them properly
      if (statusResponse.data && statusResponse.data.completed && statusResponse.data.result) {
        const result = statusResponse.data.result;
        
        // Format the result to match our expected structure
        const formattedResult = {
          data: {
            overallPrediction: result.prediction || result.overallPrediction,
            averageConfidence: result.confidence || result.averageConfidence || 0.8,
            combinedRecommendations: result.recommendations || result.combinedRecommendations || [],
            highestRiskLevel: result.riskLevel || result.highestRiskLevel || 'MEDIUM',
            modelResults: result.modelResults || [{
              model: 'MedGemma',
              prediction: result.prediction || result.overallPrediction,
              confidence: result.confidence || result.averageConfidence || 0.8,
              recommendations: result.recommendations || result.combinedRecommendations || [],
              riskLevel: result.riskLevel || result.highestRiskLevel || 'MEDIUM'
            }],
            timestamp: result.timestamp || new Date().toISOString()
          }
        };
        
        // Only log once when we first detect completion
        if (!this.completionLogged) {
          console.log('✅ Diagnosis completed - returning results to frontend');
          this.completionLogged = true;
          
          // Reset the flag after 30 seconds to allow for new diagnoses
          setTimeout(() => {
            this.completionLogged = false;
          }, 30000);
        }
        
        return {
          completed: true,
          result: formattedResult
        };
      }
      
      return {
        completed: false,
        status: statusResponse.data
      };
      
    } catch (error) {
      // Only log errors, not routine status checks
      if (error.code !== 'ECONNREFUSED') {
        console.error('⚠️ Error checking diagnosis status:', error.message);
      }
      
      // If we can't reach the microservice, assume no completed diagnosis
      return {
        completed: false,
        error: 'Could not communicate with microservice'
      };
    }
  }

  /**
   * Call microservice model for comprehensive diagnosis with recommendations
   * @private
   * @param {Object} params - Patient information
   * @param {String} modelName - Model identifier
   * @returns {Object} Comprehensive diagnosis with recommendations from microservice model
   */
  async _callMicroserviceModel(params, modelName) {
    const requestStartTime = new Date();
    console.log(`🔵 [${requestStartTime.toISOString()}] Starting comprehensive diagnosis request to ${modelName}`);
    
    // Validate request parameters
    if (!params.symptoms || typeof params.symptoms !== 'string') {
      throw new Error('Symptoms must be provided as a string');
    }
    
    console.log(`📊 Request details:`);
    console.log(`   - Microservice URL: ${this.microserviceUrl}`);
    console.log(`   - Symptoms length: ${params.symptoms.length} characters`);
    console.log(`   - Age: ${params.age || 'N/A'}`);
    console.log(`   - Gender: ${params.gender || 'N/A'}`);
    console.log(`   - History length: ${params.history ? params.history.length : 0} characters`);
    
    // Add retry mechanism with exponential backoff
    const MAX_RETRIES = 3;
    let retryCount = 0;
    
    while (retryCount <= MAX_RETRIES) {
      const attemptStartTime = new Date();
      console.log(`🔄 Attempt ${retryCount + 1}/${MAX_RETRIES + 1} at ${attemptStartTime.toISOString()}`);
      
      try {
        // Test connectivity first
        console.log(`🔍 Testing connectivity to ${this.microserviceUrl}/health`);
        try {
          const healthResponse = await axios.get(`${this.microserviceUrl}/health`, { timeout: 5000 });
          console.log(`✅ Health check passed:`, healthResponse.data);
        } catch (healthError) {
          console.error(`❌ Health check failed:`, healthError.message);
          if (healthError.code === 'ECONNREFUSED') {
            throw new Error(`Cannot connect to microservice at ${this.microserviceUrl}. Is the Python service running?`);
          }
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`⏰ Request timeout after 1800 seconds`);
          controller.abort();
        }, 1800000); // 1800 second timeout for model processing (30 minutes)
        
        const requestPayload = {
          ...params,
          // Add metadata for better tracing
          metadata: {
            model: modelName,
            timestamp: new Date().toISOString(),
            attempt: retryCount + 1
          }
        };
        
        console.log(`📤 Sending request to ${this.microserviceUrl}/predict`);
        console.log(`📋 Payload size: ${JSON.stringify(requestPayload).length} characters`);
        
        const response = await axios.post(
          `${this.microserviceUrl}/predict`,
          requestPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            signal: controller.signal,
            timeout: 1800000, // 30 minutes timeout for model processing
            validateStatus: status => status >= 200 && status < 300
          }
        );
        
        clearTimeout(timeoutId);
        
        const responseTime = new Date() - attemptStartTime;
        console.log(`✅ Response received in ${responseTime}ms`);
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📋 Response size: ${JSON.stringify(response.data).length} characters`);
        
        // Validate response structure
        if (!response.data || !response.data.prediction || typeof response.data.confidence !== 'number') {
          console.error(`❌ Invalid response format:`, response.data);
          throw new Error('Invalid response format from microservice');
        }
        
        console.log(`🎉 Comprehensive diagnosis request completed successfully`);
        return response.data;
        
      } catch (error) {
        const attemptTime = new Date() - attemptStartTime;
        console.error(`❌ Attempt ${retryCount + 1} failed after ${attemptTime}ms`);
        
        // Handle specific error cases
        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
          console.error(`⏰ Request timeout for model ${modelName} (attempt ${retryCount + 1})`);
        } else if (error.response) {
          // Server responded with a status code outside 2xx range
          console.error(`🔴 Microservice returned error ${error.response.status} for model ${modelName}:`);
          console.error(`📋 Error response:`, error.response.data);
          if (error.response.status >= 500 && retryCount < MAX_RETRIES) {
            // Server error - retry
            console.log(`🔄 Server error, will retry...`);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
            continue;
          }
        } else if (error.request) {
          // No response received
          console.error(`📡 No response received from microservice ${modelName}:`);
          console.error(`🔍 Request details:`, {
            url: error.config?.url,
            method: error.config?.method,
            timeout: error.config?.timeout
          });
          console.error(`❌ Error message:`, error.message);
          console.error(`🔍 Error code:`, error.code);
        } else {
          // Something else happened
          console.error(`🔥 Unexpected error calling microservice ${modelName}:`, error.message);
          console.error(`🔍 Error stack:`, error.stack);
        }
        
        if (retryCount === MAX_RETRIES) {
          const totalTime = new Date() - requestStartTime;
          console.error(`💥 All ${MAX_RETRIES + 1} attempts failed for model ${modelName} after ${totalTime}ms`);
          throw new Error(`All ${MAX_RETRIES + 1} attempts failed for model ${modelName}: ${error.message}`);
        }
        
        retryCount++;
        const backoffTime = 1000 * retryCount;
        console.log(`⏳ Waiting ${backoffTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

}

// Create and export singleton instance
const medicalModelService = new MedicalModelService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('medicalModelService', () => medicalModelService);
}

module.exports = medicalModelService;