/**
 * Practice Context Normalizer
 *
 * Ensures consistent practice context across all services
 * Handles different field names used by various parts of the system
 */

class PracticeContextNormalizer {
  /**
   * Normalize practice context to ensure all required fields are present
   * @param {Object} practiceContext - The practice context from various sources
   * @returns {Object} Normalized context with guaranteed fields
   */
  static normalize(practiceContext) {
    if (!practiceContext) {
      console.warn('⚠️ No practice context provided - using defaults');
      return {
        practiceId: 'global',
        practiceSubdomain: 'global',
        subdomain: 'global',
        language: 'en'
      };
    }

    // Extract practice identifier from various possible fields
    const practiceId =
      practiceContext.practiceSubdomain ||  // From routes/agent.js
      practiceContext.subdomain ||          // From some services
      practiceContext.practiceId ||         // From other services
      practiceContext.practice?.subdomain || // From practice object
      'global';                              // Default fallback

    // Ensure language is set
    const language =
      practiceContext.language ||
      practiceContext.lang ||
      'en';

    // Create normalized context with all possible field names
    // This ensures compatibility with all services
    return {
      ...practiceContext,  // Keep all original fields
      practiceId: practiceId,
      practiceSubdomain: practiceId,
      subdomain: practiceId,
      language: language,
      // Add SecureDataAccess required fields
      serviceId: practiceContext.serviceId || 'agent-service',
      operation: practiceContext.operation || 'query'
    };
  }

  /**
   * Create a SecureDataAccess context from practice context
   * @param {Object} practiceContext - The practice context
   * @param {string} operation - The operation being performed
   * @param {string} serviceId - The service identifier
   * @returns {Object} Context suitable for SecureDataAccess
   */
  static createSecureContext(practiceContext, operation = 'query', serviceId = 'agent-service') {
    const normalized = this.normalize(practiceContext);

    return {
      serviceId: serviceId,
      operation: operation,
      practiceId: normalized.practiceId,
      practiceSubdomain: normalized.practiceSubdomain,
      // Include API key if present
      apiKey: practiceContext?.apiKey || practiceContext?.token
    };
  }

  /**
   * Check if a practice context has valid practice information
   * @param {Object} practiceContext - The practice context to check
   * @returns {boolean} True if valid practice info exists
   */
  static hasValidPractice(practiceContext) {
    if (!practiceContext) return false;

    const practiceId =
      practiceContext.practiceSubdomain ||
      practiceContext.subdomain ||
      practiceContext.practiceId ||
      practiceContext.practice?.subdomain;

    return practiceId && practiceId !== 'global';
  }

  /**
   * Get practice identifier from context
   * @param {Object} practiceContext - The practice context
   * @returns {string} The practice identifier
   */
  static getPracticeId(practiceContext) {
    const normalized = this.normalize(practiceContext);
    return normalized.practiceId;
  }
}

module.exports = PracticeContextNormalizer;