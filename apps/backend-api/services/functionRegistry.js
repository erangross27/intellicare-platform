/**
 * Function Registry Service
 *
 * O(1) instant lookup for functions by name
 * Loads all functions ONCE at startup, provides instant access
 *
 * PERFORMANCE OPTIMIZATION:
 * - Before: Loading 1,352 functions per request (2-3 seconds)
 * - After: Instant lookup from memory (<10ms)
 *
 * TOOL SEARCH FEATURE (November 2025):
 * - Anthropic's Tool Search allows Claude to dynamically discover tools via regex search
 * - Tools marked with defer_loading: true are NOT loaded into context until discovered
 * - This allows scaling to 10,000+ tools without consuming context window
 * - Core tools (searchPatientsByName, etc.) are always loaded (no defer_loading)
 * - See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
 *
 * NOTE: Tool Search is INCOMPATIBLE with input_examples
 * - When using tool search, input_examples are NOT added to tools
 * - Choose one or the other based on USE_TOOL_SEARCH flag
 *
 * INPUT EXAMPLES (November 2025) - DISABLED when using Tool Search:
 * - Anthropic SDK v0.71.0+ supports input_examples in tool definitions
 * - input_examples improve Claude's parameter accuracy from 72% to 90%
 * - Examples are loaded from toolInputExamples.json (generated from collectionSystemPrompts.json)
 */

const fs = require('fs');
const path = require('path');

/**
 * TOOL SEARCH CONFIGURATION (November 2025)
 *
 * When USE_TOOL_SEARCH = true:
 * - All tools get defer_loading: true (except CORE_TOOLS)
 * - Tool Search tool is added to discover tools dynamically
 * - input_examples are NOT added (incompatible with tool search)
 * - Two-Stage Selector is bypassed
 *
 * When USE_TOOL_SEARCH = false:
 * - Original two-stage selector is used
 * - input_examples ARE added to tools
 * - No defer_loading
 */
const USE_TOOL_SEARCH = true;  // Toggle to switch between Tool Search and Two-Stage Selector

/**
 * CORE_TOOLS - Always loaded, never deferred
 * These tools are essential for basic operations and should always be available
 * without requiring Claude to search for them first.
 *
 * MINIMAL SET (November 2025): Only searchPatientsByName is core.
 * All other tools can be discovered via Tool Search - Claude will find them.
 */
const CORE_TOOLS = new Set([
  'searchPatientsByName',      // Essential - always need to find patients first
]);

class FunctionRegistry {
  constructor() {
    this.registry = new Map(); // functionName -> functionDefinition
    this.claudeFormatCache = new Map(); // functionName -> claudeFormat
    this.inputExamples = null; // functionName -> {input: {...}, description: string}
    this.initialized = false;
    this.initPromise = null;
    this.useToolSearch = USE_TOOL_SEARCH;  // Expose for other modules to check

    // Statistics
    this.stats = {
      totalFunctions: 0,
      platformFunctions: 0,
      medicalFunctions: 0,
      functionsWithExamples: 0,
      functionsWithDeferLoading: 0,
      coreFunctions: 0,
      lookupCount: 0,
      avgLookupTime: 0
    };
  }

  /**
   * Initialize the registry with all functions
   * This runs ONCE at server startup
   */
  async initialize() {
    if (this.initialized) return true;

    // Prevent multiple initializations
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  /**
   * Load input examples from toolInputExamples.json
   * These improve Claude's parameter accuracy by providing concrete usage examples
   */
  loadInputExamples() {
    try {
      const examplesPath = path.join(__dirname, 'toolInputExamples.json');
      if (fs.existsSync(examplesPath)) {
        const content = fs.readFileSync(examplesPath, 'utf8');
        this.inputExamples = JSON.parse(content);
        console.log(`   ✅ Loaded ${Object.keys(this.inputExamples).length} input examples`);
        return true;
      } else {
        console.log('   ⚠️ toolInputExamples.json not found - run scripts/generateToolInputExamples.js');
        this.inputExamples = {};
        return false;
      }
    } catch (error) {
      console.warn('   ⚠️ Failed to load input examples:', error.message);
      this.inputExamples = {};
      return false;
    }
  }

  async _doInitialize() {
    try {
      const startTime = Date.now();
      console.log('🚀 Initializing Function Registry...');

      // Load input examples first
      this.loadInputExamples();

      // Load platform functions from aiHelpers (singleton instance)
      const aiHelpers = require('./utils/aiHelpers');

      // Get all platform functions (includes medical)
      const allFunctions = aiHelpers.getAllPlatformFunctions('en', 'USA');

      if (!allFunctions || !Array.isArray(allFunctions)) {
        throw new Error('Failed to load platform functions');
      }

      // Build the registry
      for (const func of allFunctions) {
        if (func && func.name) {
          // Store original function
          this.registry.set(func.name, func);

          // Pre-convert to Claude format for faster access
          const claudeFormat = this.convertToClaudeFormat(func);
          this.claudeFormatCache.set(func.name, claudeFormat);

          // DEBUG: Log allergy functions to verify conversion
          if (func.name.includes('Allerg')) {
            const requiredFields = claudeFormat.input_schema?.required || [];
            console.log(`✅ [Registry] ${func.name} → required: [${requiredFields.join(', ')}]`);
          }

          // Update stats
          this.stats.totalFunctions++;
          if (func.type === 'medical' || func.name.includes('Medical')) {
            this.stats.medicalFunctions++;
          } else {
            this.stats.platformFunctions++;
          }
        }
      }

      const duration = Date.now() - startTime;

      console.log(`✅ Function Registry initialized in ${duration}ms`);
      console.log(`   Total functions: ${this.stats.totalFunctions}`);
      console.log(`   Platform: ${this.stats.platformFunctions}`);
      console.log(`   Medical: ${this.stats.medicalFunctions}`);
      console.log(`   With input_examples: ${this.stats.functionsWithExamples}`);

      this.initialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Function Registry:', error);
      this.initPromise = null; // Allow retry
      throw error;
    }
  }

  /**
   * Get a function by name - O(1) instant lookup
   * @param {string} functionName
   * @param {string} format - 'original' or 'claude'
   * @returns {Object|null} Function definition or null if not found
   */
  getFunction(functionName, format = 'original') {
    const startTime = performance.now();

    if (!this.initialized) {
      console.warn('⚠️ Function Registry not initialized, initializing now...');
      // Don't block, just warn
    }

    let result = null;

    if (format === 'claude') {
      result = this.claudeFormatCache.get(functionName) || null;
    } else {
      result = this.registry.get(functionName) || null;
    }

    // Update statistics
    const lookupTime = performance.now() - startTime;
    this.updateLookupStats(lookupTime);

    return result;
  }

  /**
   * Get multiple functions by name - O(n) where n is number requested
   * @param {string[]} functionNames
   * @param {string} format - 'original' or 'claude'
   * @returns {Object[]} Array of function definitions
   */
  getFunctions(functionNames, format = 'original') {
    if (!Array.isArray(functionNames)) return [];

    const functions = [];
    for (const name of functionNames) {
      const func = this.getFunction(name, format);
      if (func) {
        functions.push(func);
      } else {
        console.warn(`⚠️ Function not found in registry: ${name}`);
      }
    }

    return functions;
  }

  /**
   * Get all functions - used with Tool Search (defer_loading: true)
   * With Tool Search, all tools are sent but with defer_loading so they don't consume context.
   * Claude uses tool_search_tool_regex to find tools dynamically.
   */
  getAllFunctions(format = 'original') {

    if (format === 'claude') {
      return Array.from(this.claudeFormatCache.values());
    } else {
      return Array.from(this.registry.values());
    }
  }

  /**
   * Sanitize JSON Schema types to ensure they're valid JSON Schema draft 2020-12
   *
   * CONVERTS MongoDB/Internal types to valid JSON Schema types:
   * - ObjectId → string
   * - Date → string
   * - Mixed/mixed → object
   * - Buffer → string
   * - Any/any → anyOf union
   *
   * REMOVES invalid properties from inside property definitions:
   * - required: true/false (JSON Schema uses required array at object level)
   * - auto: true (MongoDB-specific)
   * - default: value (kept for JSON Schema, but removed if function-like)
   *
   * Valid JSON Schema types: string, number, integer, boolean, array, object, null
   */
  sanitizeSchemaType(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    // Create a new object to avoid mutating the original
    const sanitized = { ...schema };

    // MongoDB/Internal type to JSON Schema type mapping
    const typeMap = {
      'ObjectId': 'string',
      'Date': 'string',
      'Mixed': 'object',
      'mixed': 'object',
      'Buffer': 'string',
      'buffer': 'string'
    };

    // Types that should become anyOf unions (flexible types)
    const unionTypes = ['any', 'Any'];

    // REMOVE invalid properties that aren't part of JSON Schema
    // These are internal/MongoDB properties that cause validation failures
    delete sanitized.required;  // required should be array at object level, not boolean in property
    delete sanitized.auto;      // MongoDB auto-generation flag
    delete sanitized.extractable;  // IntelliCare internal flag
    delete sanitized.storable;     // IntelliCare internal flag
    delete sanitized.source;       // IntelliCare internal flag
    delete sanitized.agentVisible; // IntelliCare internal flag

    // Convert MongoDB/Internal types to JSON Schema types
    if (sanitized.type) {
      if (typeMap[sanitized.type]) {
        // Direct type mapping (ObjectId → string, Date → string, etc.)
        sanitized.type = typeMap[sanitized.type];
      } else if (unionTypes.includes(sanitized.type)) {
        // Convert "any" to anyOf union of common types
        delete sanitized.type;
        sanitized.anyOf = [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
          { type: 'object' },
          { type: 'array' }
        ];
      } else {
        // Validate against allowed JSON Schema types
        const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
        const lowerType = sanitized.type.toLowerCase();
        if (validTypes.includes(lowerType)) {
          sanitized.type = lowerType;  // Normalize to lowercase
        } else {
          // Unknown type - default to string with warning (only in development)
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`⚠️ [sanitizeSchemaType] Unknown type "${sanitized.type}" - defaulting to "string"`);
          }
          sanitized.type = 'string';
        }
      }
    }

    // Recursively sanitize nested properties
    if (sanitized.properties && typeof sanitized.properties === 'object') {
      const cleanedProperties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        cleanedProperties[key] = this.sanitizeSchemaType(value);
      }
      sanitized.properties = cleanedProperties;
    }

    // Recursively sanitize array items
    if (sanitized.items) {
      sanitized.items = this.sanitizeSchemaType(sanitized.items);
    }

    // Recursively sanitize additionalProperties
    if (sanitized.additionalProperties && typeof sanitized.additionalProperties === 'object') {
      sanitized.additionalProperties = this.sanitizeSchemaType(sanitized.additionalProperties);
    }

    // Recursively sanitize anyOf/oneOf/allOf arrays
    if (sanitized.anyOf && Array.isArray(sanitized.anyOf)) {
      sanitized.anyOf = sanitized.anyOf.map(item => this.sanitizeSchemaType(item));
    }
    if (sanitized.oneOf && Array.isArray(sanitized.oneOf)) {
      sanitized.oneOf = sanitized.oneOf.map(item => this.sanitizeSchemaType(item));
    }
    if (sanitized.allOf && Array.isArray(sanitized.allOf)) {
      sanitized.allOf = sanitized.allOf.map(item => this.sanitizeSchemaType(item));
    }

    return sanitized;
  }

  /**
   * Convert function to Claude format
   * CRITICAL FIX: Handle both internal format AND Claude format (from aiHelpers.js)
   *
   * TOOL SEARCH (November 2025):
   * - Adds defer_loading: true for non-core tools when USE_TOOL_SEARCH is enabled
   * - Core tools (CORE_TOOLS set) are always loaded without defer_loading
   * - input_examples are INCOMPATIBLE with tool search - only add when tool search is disabled
   *
   * INPUT EXAMPLES (November 2025) - DISABLED when using Tool Search:
   * - Adds input_examples from toolInputExamples.json when available
   * - input_examples improve Claude's parameter accuracy from 72% to 90%
   * - Format: [{ input: {param1: value1, ...}, description: "What this does" }]
   */
  convertToClaudeFormat(func) {
    if (!func) return null;

    let claudeFormat;

    // CHECK: Is parameters already in Claude JSON Schema format?
    // Claude format has: { type: "object", properties: {...}, required: [...] }
    // Internal format has: { fieldName: {type: "string", required: true}, ... }
    if (func.parameters && func.parameters.type === 'object' && func.parameters.properties) {
      // Already in Claude format! Sanitize and use it
      claudeFormat = {
        name: func.name,
        description: func.description || func.name,
        input_schema: this.sanitizeSchemaType(func.parameters)  // Sanitize to fix invalid types
      };
    } else {
      // ELSE: Internal format - extract properties and build required array
      const properties = {};
      const required = [];

      if (func.parameters && typeof func.parameters === 'object') {
        for (const [key, value] of Object.entries(func.parameters)) {
          // Remove 'required' field from individual properties (internal format)
          const { required: isRequired, ...cleanProperty } = value;
          // Sanitize each property to fix invalid types like "mixed"
          properties[key] = this.sanitizeSchemaType(cleanProperty);

          // Add to required array if marked as required (Claude API format)
          if (isRequired === true) {
            required.push(key);
          }
        }
      }

      // Convert to Claude's expected format with input_schema
      claudeFormat = {
        name: func.name,
        description: func.description || func.name,
        input_schema: {
          type: 'object',
          properties: properties,
          required: required  // Array of required field names
        }
      };
    }

    // TOOL SEARCH: Add defer_loading for non-core tools (November 2025)
    // Tools with defer_loading: true are NOT loaded into context until discovered via search
    // Core tools are always loaded (no defer_loading) for essential operations
    if (USE_TOOL_SEARCH) {
      const isCoreFunction = CORE_TOOLS.has(func.name);
      if (!isCoreFunction) {
        claudeFormat.defer_loading = true;
        this.stats.functionsWithDeferLoading++;
      } else {
        this.stats.coreFunctions++;
      }
    }

    // ADD INPUT EXAMPLES if available (Anthropic SDK v0.71.0+ feature)
    // CRITICAL: input_examples are INCOMPATIBLE with tool search - only add when disabled
    // When tool search is enabled, Claude discovers tools via search, not examples
    if (!USE_TOOL_SEARCH && this.inputExamples && this.inputExamples[func.name]) {
      const example = this.inputExamples[func.name];
      claudeFormat.input_examples = [example.input];  // Direct parameters, not wrapped
      this.stats.functionsWithExamples++;
    }

    // ADD ALLOWED_CALLERS for Programmatic Tool Calling
    // Forces Claude to call tools via code execution - prevents skipping/hallucination
    // Claude must write Python code that executes await tool_name(...) - cannot skip
    // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
    //
    // CRITICAL: allowed_callers is INCOMPATIBLE with Tool Search
    // When using defer_loading: true, tools should NOT have allowed_callers
    // The Tool Search feature expects simple tool definitions
    if (!USE_TOOL_SEARCH) {
      claudeFormat.allowed_callers = ["code_execution_20260120"];
    }

    return claudeFormat;
  }

  /**
   * Update lookup statistics
   */
  updateLookupStats(lookupTime) {
    this.stats.lookupCount++;
    const count = this.stats.lookupCount;
    const currentAvg = this.stats.avgLookupTime;

    // Calculate running average
    this.stats.avgLookupTime = ((currentAvg * (count - 1)) + lookupTime) / count;
  }

  /**
   * Check if a function exists
   */
  hasFunction(functionName) {
    return this.registry.has(functionName);
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      ...this.stats,
      avgLookupTimeMs: this.stats.avgLookupTime.toFixed(3),
      cacheHitRate: this.initialized ? '100%' : '0%',
      inputExamplesLoaded: this.inputExamples ? Object.keys(this.inputExamples).length : 0,
      useToolSearch: USE_TOOL_SEARCH,
      coreFunctionsCount: CORE_TOOLS.size
    };
  }

  /**
   * Get the Tool Search tool definition (November 2025)
   * This special tool allows Claude to search for tools dynamically
   * Must be included when USE_TOOL_SEARCH is enabled
   *
   * Two variants available:
   * - tool_search_tool_regex_20251119: Uses Python regex patterns (e.g., "get.*medication")
   * - tool_search_tool_bm25_20251119: Uses natural language queries (e.g., "get patient medications")
   *
   * BM25 (natural language) is better for IntelliCare's 1,500+ medical tools because:
   * - Claude can search semantically (e.g., "allergy functions", "lab result tools")
   * - No need to construct regex patterns
   * - More intuitive for discovering tools by description
   *
   * See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
   */
  getToolSearchTool() {
    // BM25 variant - Natural language/semantic search (December 2025)
    // Claude searches with natural language: "check manufacturer FDA compliance", "drug shortages"
    // BM25 reads tool DESCRIPTIONS semantically and finds the right tool
    // Better for IntelliCare's 1,500+ medical tools - Claude can describe what it needs
    // Example: User asks "Does Teva have FDA issues?" → Claude searches "manufacturer compliance FDA"
    //          → Finds checkManufacturerCompliance based on description match
    // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
    return {
      type: "tool_search_tool_bm25_20251119",
      name: "tool_search_tool_bm25"
    };
  }

  /**
   * Check if Tool Search is enabled
   */
  isToolSearchEnabled() {
    return USE_TOOL_SEARCH;
  }

  /**
   * Get list of core tool names (always loaded, no defer_loading)
   */
  getCoreFunctions() {
    return Array.from(CORE_TOOLS);
  }

  /**
   * Search for functions by partial name or keyword
   * Use sparingly - this is O(n) not O(1)
   */
  searchFunctions(keyword) {
    const results = [];
    const keywordLower = keyword.toLowerCase();

    for (const [name, func] of this.registry.entries()) {
      if (name.toLowerCase().includes(keywordLower) ||
          (func.description && func.description.toLowerCase().includes(keywordLower))) {
        results.push(func);
      }
    }

    return results;
  }

  /**
   * Clear the registry (for testing)
   */
  clear() {
    this.registry.clear();
    this.claudeFormatCache.clear();
    this.inputExamples = null;
    this.initialized = false;
    this.initPromise = null;
    this.stats = {
      totalFunctions: 0,
      platformFunctions: 0,
      medicalFunctions: 0,
      functionsWithExamples: 0,
      lookupCount: 0,
      avgLookupTime: 0
    };
  }
}

// Export singleton instance
module.exports = new FunctionRegistry();