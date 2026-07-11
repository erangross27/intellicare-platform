/**
 * Intelligent Model Selector
 * Chooses between Haiku (fast/cheap) and Sonnet (powerful) based on query complexity
 */

class IntelligentModelSelector {
  constructor() {
    this.complexityPatterns = this.initializePatterns();
  }

  initializePatterns() {
    return {
      // Simple queries that Haiku can handle
      simple: [
        /^(list|show|display|get)\s+(all\s+)?(patients?|appointments?|users?)/i,
        /^(find|search|look for)\s+\w+\s+\w+$/i, // Simple name searches
        /^(count|how many)/i,
        /^(schedule|cancel|reschedule)\s+appointment/i,
        /^(add|update|delete)\s+(patient|user|appointment)$/i,
        /^(show|get)\s+today'?s?\s+appointments?/i,
        /^what\s+(patients?|appointments?)\s+do\s+(we|i)\s+have/i
      ],

      // Complex queries that need Sonnet
      complex: [
        // Medical reasoning
        /diagnos|symptom|treatment|medication|prescription|dosage/i,
        /medical\s+(history|condition|record)/i,
        /lab\s+(result|test|report)/i,
        /differential|clinical|pathology/i,

        // Complex multi-step operations
        /and\s+then|after\s+that|followed\s+by/i,
        /multiple|several|batch|bulk/i,

        // Financial/Insurance
        /insurance|claim|billing|payment|reimburse/i,

        // Analysis and insights
        /analyze|compare|recommend|suggest|explain/i,
        /why|how|what\s+if|should/i,

        // Hebrew content (might need better handling)
        /[\u0590-\u05FF]/  // Hebrew characters
      ]
    };
  }

  /**
   * Determine if query is simple enough for Haiku
   */
  isSimpleQuery(message, functionCount = 0) {
    const messageStr = typeof message === 'string' ? message : String(message || '');

    // Empty or very short messages are simple
    if (messageStr.length < 10) return true;

    // If only 1-2 functions selected, probably simple
    if (functionCount > 0 && functionCount <= 2) return true;

    // Check if matches simple patterns
    for (const pattern of this.complexityPatterns.simple) {
      if (pattern.test(messageStr)) {
        return true;
      }
    }

    // Check if matches complex patterns
    for (const pattern of this.complexityPatterns.complex) {
      if (pattern.test(messageStr)) {
        return false; // Use Sonnet for complex
      }
    }

    // Default to simple for unmatched patterns
    return true;
  }

  /**
   * Select the appropriate model based on query complexity
   */
  selectModel(message, context = {}) {
    const isSimple = this.isSimpleQuery(message, context.functionCount);

    // Always use Haiku now for consistent performance and cost savings
    const model = 'claude-sonnet-5';  // Claude Sonnet 5

    const reason = isSimple
      ? 'Simple query - using Haiku model'
      : 'Complex query - using Haiku model (optimized for performance)';

    console.log(`🤖 Model Selection: ${model}`);
    console.log(`   Reason: ${reason}`);

    return {
      model,
      isSimple,
      reason,
      costMultiplier: isSimple ? 1 : 20 // Sonnet is 20x more expensive
    };
  }

  /**
   * Track model usage for cost analysis
   */
  trackUsage(model, tokens) {
    // This could be expanded to track usage patterns
    const cost = model.includes('haiku')
      ? tokens * 0.00000025  // $0.25 per 1M tokens
      : tokens * 0.000005;    // $5 per 1M tokens

    return cost;
  }
}

module.exports = new IntelligentModelSelector();