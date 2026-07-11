/**
 * CSV Import Cache Helper for Claude API
 *
 * Optimizes CSV patient imports by utilizing Claude's cache_control feature
 * to cache validation rules and patterns, reducing API token usage by 90%+
 *
 * Cache Strategy:
 * - System prompts: cached with ephemeral (5 minutes)
 * - Tool definitions: cached with ephemeral
 * - CSV schema/validation rules: cached with ephemeral
 * - Patient-specific data: not cached (unique per patient)
 */

class CSVImportCacheHelper {
  constructor() {
    this.validationSchemas = new Map();
  }

  /**
   * Build cached system message for CSV import validation
   * Includes all validation rules that apply to all patients
   */
  buildCachedValidationSystem(practiceContext) {
    const isHebrew = practiceContext.language === 'he';
    const country = practiceContext.country || 'USA';
    const isUSA = country === 'United States' || country === 'USA' || country === 'US';
    const isIsrael = country === 'Israel' || country === 'IL';

    const systemMessage = {
      type: 'text',
      text: `You are processing patient data from a CSV import for a ${country} medical practice.

VALIDATION RULES (Apply to ALL patients in this import):

${isUSA ? `USA REQUIREMENTS:
- First name and last name are REQUIRED
- Insurance provider is REQUIRED
- Social Security Number format: XXX-XX-XXXX (optional but validate format if provided)
- Valid US insurance providers: Blue Cross, Blue Shield, Aetna, Kaiser Permanente, Cigna, Anthem, UnitedHealth, Humana, Medicare, Medicaid
- Date format: MM/DD/YYYY must be converted to ISO format
- Phone format: (XXX) XXX-XXXX or XXX-XXX-XXXX
- State must be valid US state code (2 letters)
- ZIP code must be 5 or 9 digits` : ''}

${isIsrael ? `ISRAEL REQUIREMENTS:
- First name and last name are REQUIRED (Hebrew or English)
- Health fund (קופת חולים) is REQUIRED
- Valid health funds: כללית (Clalit), מכבי (Maccabi), מאוחדת (Meuhedet), לאומית (Leumit)
- National ID (ת.ז.) format: 9 digits
- Phone format: 05X-XXXXXXX or 0X-XXXXXXX
- Date format: DD/MM/YYYY must be converted to ISO format` : ''}

DUPLICATE DETECTION RULES:
- Primary match: SSN (USA) or National ID (Israel)
- Secondary match: First name + Last name + Date of birth
- If duplicate found: UPDATE existing patient, don't create new

DATA NORMALIZATION:
- Trim all whitespace
- Remove quotes from values
- Normalize insurance provider names to standard format
- Convert dates to ISO format
- Format phone numbers consistently

BATCH PROCESSING:
- Process patients in batches of 5 for optimal performance
- Validate all required fields before database operations
- Return detailed results for success, updates, and failures`,
      cache_control: { type: 'ephemeral' }  // Cache for 5 minutes
    };

    return systemMessage;
  }

  /**
   * Build cached CSV schema message
   * Contains the structure and mappings that apply to the entire import
   */
  buildCachedSchemaMessage(headers, mappings, sampleRow) {
    const schemaMessage = {
      type: 'text',
      text: `CSV IMPORT SCHEMA:

Headers: ${headers.join(', ')}
Sample Row: ${sampleRow.join(', ')}

COLUMN MAPPINGS (Apply to all rows):
${JSON.stringify(mappings, null, 2)}

This schema applies to ALL patients in this CSV import batch.
Use these mappings consistently for every row processed.`,
      cache_control: { type: 'ephemeral' }  // Cache the schema
    };

    return schemaMessage;
  }

  /**
   * Build validation prompt with caching for Claude API
   * Separates cached (common) and uncached (unique) content
   */
  buildValidationPrompt(practiceContext, csvSchema, patientBatch) {
    const messages = [];

    // Add cached system validation rules
    messages.push(this.buildCachedValidationSystem(practiceContext));

    // Add cached CSV schema
    if (csvSchema) {
      messages.push(this.buildCachedSchemaMessage(
        csvSchema.headers,
        csvSchema.mappings,
        csvSchema.sampleRow
      ));
    }

    // Add uncached patient-specific data (this changes per batch)
    messages.push({
      type: 'text',
      text: `PATIENT BATCH TO VALIDATE:
${JSON.stringify(patientBatch, null, 2)}

Please validate these patients according to the rules and schema above.`
      // No cache_control here - this is unique per batch
    });

    return messages;
  }

  /**
   * Calculate cache statistics for monitoring
   */
  calculateCacheStats(apiResponse) {
    if (!apiResponse?.usage) return null;

    const usage = apiResponse.usage;
    const stats = {
      inputTokens: usage.input_tokens || 0,
      cacheReadTokens: usage.cache_read_tokens || 0,
      cacheWriteTokens: usage.cache_write_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheHitRate: 0,
      tokensSaved: 0
    };

    // Calculate cache hit rate
    if (stats.inputTokens > 0) {
      stats.cacheHitRate = (stats.cacheReadTokens / stats.inputTokens) * 100;
    }

    // Calculate tokens saved by caching
    stats.tokensSaved = stats.cacheReadTokens;

    return stats;
  }

  /**
   * Format cache stats for logging
   */
  formatCacheStats(stats) {
    if (!stats) return 'No cache statistics available';

    return `📊 Cache Stats:
  • Input: ${stats.inputTokens} tokens
  • Cache Read: ${stats.cacheReadTokens} tokens (${stats.cacheHitRate.toFixed(1)}% hit rate)
  • Cache Write: ${stats.cacheWriteTokens} tokens
  • Output: ${stats.outputTokens} tokens
  • Tokens Saved: ${stats.tokensSaved} (${((stats.tokensSaved / (stats.inputTokens || 1)) * 100).toFixed(1)}% reduction)`;
  }

  /**
   * Optimize API calls for CSV import by batching and caching
   */
  async optimizeCSVImportCall(claudeClient, systemMessages, userMessage, tools) {
    try {
      // Build the API request with proper caching
      const request = {
        model: 'claude-sonnet-5',  // Claude Sonnet 5
        max_tokens: 20000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system: systemMessages,  // These should have cache_control
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      };

      // Add tools if provided (should also have cache_control on first few)
      if (tools && tools.length > 0) {
        request.tools = tools;
        request.tool_choice = { type: 'auto' };
      }

      // Make the API call
      const response = await claudeClient.messages.create(request);

      // Calculate and log cache statistics
      const cacheStats = this.calculateCacheStats(response);
      if (cacheStats && cacheStats.cacheReadTokens > 0) {
        console.log(this.formatCacheStats(cacheStats));
      }

      return response;
    } catch (error) {
      console.error('CSV import cache optimization failed:', error);
      throw error;
    }
  }

  /**
   * Build optimized tool definitions with caching
   */
  buildCachedToolDefinitions(tools) {
    if (!tools || tools.length === 0) return [];

    // Cache the first 3-5 most commonly used tools
    const TOOLS_TO_CACHE = 5;

    return tools.map((tool, index) => {
      const toolDef = {
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema || tool.parameters
      };

      // Add cache_control to the first few tools
      if (index < TOOLS_TO_CACHE) {
        toolDef.cache_control = { type: 'ephemeral' };
      }

      return toolDef;
    });
  }

  /**
   * Prepare CSV validation request with optimal caching
   */
  prepareValidationRequest(practiceContext, csvData, validationRules) {
    const cachedParts = [];
    const uncachedParts = [];

    // Build cached validation system
    cachedParts.push({
      type: 'text',
      text: `MEDICAL PRACTICE CONTEXT:
Country: ${practiceContext.country || 'USA'}
Language: ${practiceContext.language || 'en'}
Practice ID: ${practiceContext.practiceId}

CSV VALIDATION FRAMEWORK:
${JSON.stringify(validationRules, null, 2)}

These rules apply to ALL patients in this import session.`,
      cache_control: { type: 'ephemeral' }
    });

    // Add CSV structure (cached)
    if (csvData.headers) {
      cachedParts.push({
        type: 'text',
        text: `CSV STRUCTURE:
Headers: ${csvData.headers.join(', ')}
Total Rows: ${csvData.totalRows}
Import Session ID: ${csvData.sessionId}`,
        cache_control: { type: 'ephemeral' }
      });
    }

    // Add patient data (not cached - unique)
    uncachedParts.push({
      type: 'text',
      text: `PATIENTS TO PROCESS:
${JSON.stringify(csvData.patients, null, 2)}`
    });

    return {
      cached: cachedParts,
      uncached: uncachedParts,
      all: [...cachedParts, ...uncachedParts]
    };
  }
}

module.exports = new CSVImportCacheHelper();