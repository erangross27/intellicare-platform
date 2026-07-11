/**
 * Claude Batch Processor - Phase 2: Targeted Extraction (one-shot composite tool)
 *
 * Takes the collection list from Phase 1 and performs targeted extraction with:
 * 1. ONE composite tool (extract_medical_data) whose input schema has one
 *    array property per selected collection (per-collection schemas reused unchanged)
 * 2. A forced single tool call: tool_choice {type:'tool'} + disable_parallel_tool_use
 *    - no dependence on parallel tool calls (works on Opus 4.5/4.6/4.8 and later)
 * 3. Collection-specific system prompts (targeted extraction guidance)
 *
 * ONE batch request per document. Result parsed by the single-tool
 * extract_medical_data branch in claudeBatchProcessor.extractAnalysisFromToolUse.
 *
 * Created: November 2025; one-shot composite tool: June 2026
 */

const unifiedSchemas = require('./unifiedMedicalSchemas');  // Singleton instance
const ClaudeBatchProcessorToolUse = require('./claudeBatchProcessorToolUse');
const fs = require('fs');
const path = require('path');

class ClaudeBatchProcessorPhase2 {
  constructor() {
    this.schemas = unifiedSchemas;  // Use singleton instance
    this.toolBuilder = new ClaudeBatchProcessorToolUse();
    this.allPrompts = null;  // Lazy-load ALL prompts when needed
  }

  /**
   * Load full tool schemas ONLY for selected collections
   * This is where we save massive tokens - only 20-40 tools instead of 676
   *
   * @param {Array} selectedCollections - Collections selected by Phase 1
   * @returns {Array} Full tool schemas for selected collections
   */
  buildSelectedTools(selectedCollections) {
    const tools = [];

    // Filter out 'patient' - it's handled separately by the system
    const validCollections = selectedCollections.filter(name => name !== 'patient');

    for (const collectionName of validCollections) {
      const schema = this.schemas.getExtractionSchema(collectionName);

      if (!schema || Object.keys(schema).length === 0) {
        console.warn(`⚠️  No schema found for ${collectionName}, skipping`);
        continue;
      }

      // Build full Anthropic tool schema
      const tool = this.toolBuilder.buildExtractionTool(collectionName, schema);
      tools.push(tool);
    }

    console.log(`✅ Built ${tools.length} full tool schemas for selected collections`);
    return tools;
  }

  /**
   * Build ONE composite extraction tool covering all selected collections.
   *
   * Each selected collection becomes an array-typed property whose items reuse
   * the existing per-collection input_schema (from buildExtractionTool). The
   * model is forced to call this single tool exactly once, so extraction no
   * longer depends on the model emitting 40-50 parallel tool calls (which only
   * Opus 4.5 does in batch responses).
   *
   * @param {Array} selectedCollections - Collections selected by Phase 1
   * @returns {object} { tool, collections } - composite tool + collection names
   *                   actually included (valid schemas only, 'patient' excluded)
   */
  buildCompositeTool(selectedCollections) {
    const validCollections = selectedCollections.filter(name => name !== 'patient');

    const properties = {
      patient_name: {
        type: 'string',
        description: "The patient's full name EXACTLY as written in the document (format: 'First Last' or 'Last, First')"
      },
      category: {
        type: 'string',
        description: "The collection name that best describes this document type (e.g. 'discharge_summaries', 'lab_results', 'consultation_notes')"
      }
    };

    const includedCollections = [];
    for (const collectionName of validCollections) {
      const schema = this.schemas.getExtractionSchema(collectionName);

      if (!schema || Object.keys(schema).length === 0) {
        console.warn(`⚠️  No schema found for ${collectionName}, skipping`);
        continue;
      }

      const perCollectionTool = this.toolBuilder.buildExtractionTool(collectionName);
      const label = collectionName.replace(/_/g, ' ');

      properties[collectionName] = {
        type: 'array',
        description: `${label} records found in the document. One array item per distinct instance (e.g. one item per medication, per diagnosis, per lab test). Use [] when the document contains no ${label} data.`,
        items: perCollectionTool.input_schema
      };
      includedCollections.push(collectionName);
    }

    console.log(`✅ Built composite extract_medical_data tool with ${includedCollections.length} collection arrays`);

    return {
      tool: {
        name: 'extract_medical_data',
        description: 'Extract ALL medical data from the document into one structured object. Fill every collection array: one item per real instance found in the document, [] when the collection has no data. Extract only what is explicitly written in the document.',
        input_schema: {
          type: 'object',
          properties: properties,
          required: ['patient_name', 'category']
        }
      },
      collections: includedCollections
    };
  }

  /**
   * Generate collection-specific system prompt
   * Each collection gets targeted extraction guidance
   *
   * @param {string} collectionName - Collection name
   * @returns {string} Collection-specific extraction guidance
   */
  generateCollectionPrompt(collectionName) {
    // Use pre-loaded prompts from constructor
    const collectionPrompts = this.collectionPrompts;

    // If we have a custom prompt for this collection, use it
    if (collectionPrompts[collectionName]) {
      return collectionPrompts[collectionName];
    }

    // Otherwise generate generic prompt
    const schema = this.schemas.getExtractionSchema(collectionName);

    // Check if schema exists and is not empty
    if (!schema || Object.keys(schema).length === 0) {
      console.warn(`⚠️  No schema found for ${collectionName} in generateCollectionPrompt, using minimal prompt`);
      return `Extract all available data for ${collectionName} collection from the document.`;
    }

    const extractableFields = Object.entries(schema)
      .filter(([_, fieldDef]) => fieldDef.extractable === true);
    const fieldCount = extractableFields.length;

    const label = collectionName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return `
🔍 ${label} (${collectionName}):
Extract ALL ${fieldCount} fields from the document. Search the ENTIRE document for information to populate each field.

📋 Field extraction approach:
- Review each of the ${fieldCount} fields in the ${collectionName} array items
- Search across all document sections for relevant data
- Extract verbatim text (don't summarize or paraphrase)
- Leave fields empty ONLY if information truly doesn't exist

⚠️ Common sections to check:
- Chief Complaint, History of Present Illness
- Past Medical History, Family History, Social History
- Physical Exam, Review of Systems
- Assessment & Plan, Discharge Summary
- Lab Results, Imaging Reports, Procedure Notes

✅ Goal: Populate >80% of the ${fieldCount} available fields when document contains relevant data.`;
  }

  /**
   * Load collection-specific prompts ONLY for selected collections
   * Filter to only the collections we need instead of loading all 750
   *
   * @param {Array} selectedCollections - Collections selected by Phase 1
   * @returns {object} Map of collection names to system prompts (only selected ones)
   */
  loadCollectionPrompts(selectedCollections) {
    // Check if system prompts file exists
    const promptsPath = path.join(__dirname, 'collectionSystemPrompts.json');

    if (!fs.existsSync(promptsPath)) {
      return {};  // File doesn't exist yet
    }

    try {
      // Lazy-load all prompts ONCE and cache
      if (!this.allPrompts) {
        this.allPrompts = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
        console.log(`📚 Loaded ${Object.keys(this.allPrompts).length} collection-specific prompts from file`);
      }

      // Filter to ONLY the selected collections (32 instead of 750)
      const filteredPrompts = {};
      for (const collection of selectedCollections) {
        if (this.allPrompts[collection]) {
          filteredPrompts[collection] = this.allPrompts[collection];
        }
      }

      console.log(`✅ Using ${Object.keys(filteredPrompts).length} prompts for ${selectedCollections.length} selected collections`);
      return filteredPrompts;
    } catch (error) {
      console.warn(`⚠️  Error loading collection prompts: ${error.message}`);
      return {};
    }
  }

  /**
   * Create Phase 2 system prompt for the one-shot composite tool.
   * Combines generic extraction rules + collection-specific guidance.
   *
   * @param {Array} includedCollections - Collections present in the composite
   *                tool (already filtered: valid schemas only, no 'patient')
   * @returns {string} Complete Phase 2 system prompt
   */
  createPhase2SystemPrompt(includedCollections) {
    // Load prompts ONLY for the collections in the composite tool
    this.collectionPrompts = this.loadCollectionPrompts(includedCollections);

    const collectionGuidance = includedCollections
      .map(collection => this.generateCollectionPrompt(collection))
      .join('\n\n');

    return `You are a medical data extraction specialist. Extract comprehensive medical data from this document by calling the extract_medical_data tool EXACTLY ONCE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO FILL THE TOOL INPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The tool input has one ARRAY property per medical collection (${includedCollections.length} collections in this request).

✓ For EACH collection array, search the ENTIRE document and add one array item per distinct instance:
  - medications: one item per medication
  - diagnoses: one item per diagnosis
  - lab_results: one item per lab test
✓ Fill ALL fields of each item that the document supports - don't skip optional fields when the data exists
✓ Use an empty array [] ONLY when the document genuinely contains no data for that collection
✓ Also fill patient_name (the patient's full name exactly as written) and category (the collection name that best describes this document type)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION RULES - ANTI-HALLUCINATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Extract ONLY what is EXPLICITLY WRITTEN in the document
✓ Use ONLY field names from the tool's schema - never invent new fields
✓ Search the ENTIRE document for each field (don't stop at first section)
✓ Leave fields empty if information truly doesn't exist - never add "Not documented"
✓ DO NOT infer, assume, or add ANY information not directly stated
✓ Extract exact wording - preserve original phrasing

❌ FORBIDDEN:
• Fabricating reference ranges, values, or clinical findings
• Adding information from your medical knowledge
• Inferring dates/times not explicitly stated
• Copying values between different fields/records

⚠️ Common sections to check for every collection:
- Chief Complaint, History of Present Illness
- Past Medical History, Family History, Social History
- Physical Exam, Review of Systems
- Assessment & Plan, Discharge Summary
- Lab Results, Imaging Reports, Procedure Notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLLECTION-SPECIFIC EXTRACTION GUIDANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${collectionGuidance}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REMEMBER: One tool call containing everything. Each collection array item has a schema with specific fields - extract ALL fields listed. Use field names EXACTLY as defined.`;
  }

  /**
   * Build message content with proper PDF format
   */
  buildMessageContent(document, includedCollections) {
    const collectionCount = includedCollections.length;

    const textPrompt = `Extract all medical data from this document. Call the extract_medical_data tool exactly once, filling all ${collectionCount} collection arrays plus patient_name and category. Add one array item per distinct instance (one per medication, per diagnosis, per lab test, etc.).`;

    // Check if content is base64 PDF
    const isBase64PDF = typeof document.content === 'string' &&
                        (document.content.startsWith('JVBERi0') || // PDF magic bytes
                         document.contentType === 'application/pdf');

    if (isBase64PDF) {
      // PDF format for Claude
      return [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: document.content
          }
        },
        {
          type: 'text',
          text: textPrompt
        }
      ];
    } else {
      // Plain text format
      return `${textPrompt}

DOCUMENT:
${document.content}`;
    }
  }

  /**
   * Create Phase 2 batch request - ONE request per document, ONE tool, ONE forced call
   *
   * model claude-opus-4-8: forced tool_choice works when the thinking param is
   * omitted; temperature is rejected with 400 on Opus 4.7+ so it must NOT be set.
   * disable_parallel_tool_use guarantees EXACTLY ONE tool call in the response.
   *
   * @param {object} document - Document to analyze
   * @param {Array} selectedCollections - Collections selected by Phase 1
   * @param {string} practiceId - Practice ID
   * @returns {object} Phase 2 batch request
   */
  createPhase2BatchRequest(document, selectedCollections, practiceId) {
    const { tool: compositeTool, collections: includedCollections } = this.buildCompositeTool(selectedCollections);
    const systemPrompt = this.createPhase2SystemPrompt(includedCollections);
    // Prompt caching: the extraction tool + system prefix are identical for documents that select the
    // same collection set (common for similar document types in a batch) → cache for best-effort reuse.
    compositeTool.cache_control = { type: 'ephemeral' };

    return {
      custom_id: `${practiceId}_phase2_${Date.now()}`,
      params: {
        model: 'claude-opus-4-8',  // ONE forced tool call - safe on 4.8 (no thinking param, no temperature: both rejected)
        max_tokens: 128000,  // Opus 4.8 standard max output (same as Phase 1); worst-case output cost $1.60/doc in batch
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: this.buildMessageContent(document, includedCollections)
          }
        ],
        tools: [compositeTool],
        // EXACTLY ONE tool call per response - no parallel-tool-call dependence (Opus 4.6+/4.8 safe)
        tool_choice: { type: 'tool', name: 'extract_medical_data', disable_parallel_tool_use: true }
      }
    };
  }

  /**
   * Extract collection-specific system prompts from claudeBatchProcessor.js
   * These are the detailed prompts we spent time creating
   *
   * This function reads the massive system prompt in claudeBatchProcessor.js
   * and extracts the collection-specific sections to save them as separate prompts
   *
   * @returns {object} Map of collection names to extracted prompts
   */
  extractSystemPromptsFromMainFile() {
    const mainProcessorPath = path.join(__dirname, 'claudeBatchProcessor.js');
    const content = fs.readFileSync(mainProcessorPath, 'utf8');

    // Find the system prompt string (it's inside the template literal)
    const systemPromptMatch = content.match(/system:\s*`([^`]*)`/s);
    if (!systemPromptMatch) {
      console.error('❌ Could not find system prompt in claudeBatchProcessor.js');
      return {};
    }

    const systemPrompt = systemPromptMatch[1];
    const collectionPrompts = {};

    // Pattern to find collection-specific sections
    // Looking for patterns like:
    // 🏥 HISTORY OF PRESENT ILLNESS (history_present_illness) - WHERE TO LOOK + COMPLETE EXAMPLE
    // or
    // 🔬 MEDICATIONS (medications) - WHERE TO LOOK + COMPLETE EXAMPLES:

    const collectionSectionRegex = /[🔬🏥💊📊🫀🩸📋🔍]\s+([A-Z\s]+)\s+\(([a-z_]+)\)\s+-\s+WHERE TO LOOK.*?(?=(?:[🔬🏥💊📊🫀🩸📋🔍]\s+[A-Z]|PART \d+|═══════|$))/gs;

    let match;
    while ((match = collectionSectionRegex.exec(systemPrompt)) !== null) {
      const label = match[1].trim();
      const collectionName = match[2];
      const promptContent = match[0];

      collectionPrompts[collectionName] = promptContent;
      console.log(`✅ Extracted prompt for ${collectionName} (${promptContent.length} chars)`);
    }

    return collectionPrompts;
  }

  /**
   * Save collection-specific prompts to JSON file
   * Run this once to extract prompts from main processor
   */
  saveCollectionPrompts() {
    const prompts = this.extractSystemPromptsFromMainFile();
    const outputPath = path.join(__dirname, 'collectionSystemPrompts.json');

    fs.writeFileSync(outputPath, JSON.stringify(prompts, null, 2));
    console.log(`✅ Saved ${Object.keys(prompts).length} collection prompts to ${outputPath}`);

    return prompts;
  }

  /**
   * ASYNC METHOD: Submit Phase 2 batch with selected tools
   * Returns batch ID immediately, worker handles completion
   *
   * @param {Array} documents - Documents to analyze
   * @param {Array} selectedCollections - Collections selected by Phase 1
   * @param {string} practiceId - Practice ID
   * @returns {string} Phase 2 batch ID
   */
  async extractWithSelectedTools(documents, selectedCollections, practiceId) {
    console.log('📤 Phase 2: Submitting batch for targeted extraction...');
    console.log(`📋 Using ${selectedCollections.length} selected collections`);

    const secureConfigService = require('./secureConfigService');
    const Anthropic = require('@anthropic-ai/sdk');

    // Get API key - try secureConfigService first, then KMS
    let apiKey = secureConfigService.get('CLAUDE_API_KEY') || secureConfigService.get('ANTHROPIC_API_KEY');

    if (!apiKey) {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      apiKey = await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
    }

    if (!apiKey) {
      throw new Error('Failed to retrieve ANTHROPIC_API_KEY from secureConfigService or KMS');
    }

    // Create Phase 2 batch requests (one per document)
    const requests = documents.map((doc, index) => {
      const request = this.createPhase2BatchRequest(doc, selectedCollections, practiceId);
      request.custom_id = `${practiceId}_phase2_${Date.now()}_doc${index}`;
      return request;
    });

    // 🛡️ ONE BATCH REQUEST PER DOCUMENT - hard invariant (lesson from the $75 fan-out incident).
    // The 40-50 collections live INSIDE the single composite tool, never as extra requests.
    if (requests.length !== documents.length) {
      throw new Error(`Phase 2 invariant violated: built ${requests.length} batch requests for ${documents.length} document(s) - refusing to submit`);
    }

    console.log('📦 Phase 2: Submitting batch to Anthropic API with', requests.length, 'requests');

    // Use official Anthropic SDK for better compatibility
    const anthropic = new Anthropic({
      apiKey: apiKey,
      timeout: 60000, // 60 second timeout for batch creation
      maxRetries: 3
    });

    try {
      // 🛡️ COST CIRCUIT BREAKER: refuses submission above BATCH_MAX_COST_USD (default $10)
      const { assertBatchCostWithinBudget } = require('./batchCostGuard');
      assertBatchCostWithinBudget(requests, 'Phase 2');

      const batch = await anthropic.messages.batches.create({ requests });

      console.log(`✅ Phase 2 batch submitted: ${batch.id}`);
      console.log(`📊 Batch contains ${requests.length} document(s)`);
      console.log(`🔧 ONE composite tool covering ${selectedCollections.length} selected collections`);
      console.log(`⏳ Status: ${batch.processing_status}`);

      return batch.id;
    } catch (error) {
      console.error('❌ Phase 2 batch creation failed:', error.message);
      if (error.status) console.error('   HTTP Status:', error.status);
      if (error.error) console.error('   API Error:', JSON.stringify(error.error, null, 2));
      throw error;
    }
  }
}

module.exports = ClaudeBatchProcessorPhase2;
