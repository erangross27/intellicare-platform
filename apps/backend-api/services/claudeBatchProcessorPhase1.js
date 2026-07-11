/**
 * Claude Batch Processor - Phase 1: Tool Selection
 *
 * Two-pass batch extraction strategy:
 * Phase 1: Claude selects 20-40 relevant collections (this file)
 * Phase 2: Full extraction with only selected tools (claudeBatchProcessorPhase2.js)
 *
 * Benefits:
 * - Reduces tokens from ~471K to ~50K (Phase 1) + ~150K (Phase 2) = 200K total
 * - 57% token savings
 * - Improves Claude's focus and extraction quality
 *
 * Created: November 2025
 */

const unifiedSchemas = require('./unifiedMedicalSchemas');  // Singleton instance

// Import medicalCollectionsService to get ACTUAL collection names (user maintains this)
const medicalCollectionsService = require('./medicalCollectionsService');

class ClaudeBatchProcessorPhase1 {
  constructor() {
    this.schemas = unifiedSchemas;  // Use singleton instance
  }

  /**
   * Build lightweight tool descriptors for Phase 1 tool selection
   * Only includes: name, description (1-2 lines)
   * Does NOT include: input_schema (saves ~95% of tokens per tool)
   *
   * @returns {Array} Lightweight tool descriptors
   */
  buildLightweightToolDescriptors() {
    // Use ACTUAL collection names from medicalCollectionsService (user maintains this)
    // Not from unified schema which may have outdated names (providers vs patient_provider)
    const actualCollections = medicalCollectionsService.getAllCollections();
    const lightweightTools = [];

    // For each actual collection, try to get schema (may not exist if collection was renamed)
    for (const collectionName of actualCollections) {
      const schema = this.schemas.getExtractionSchema(collectionName);

      // Skip if no schema found (collection may have been renamed in DB but not in schema)
      if (!schema || Object.keys(schema).length === 0) {
        console.warn(`⚠️  No schema for ${collectionName}, using generic description`);
        lightweightTools.push({
          name: collectionName,
          label: collectionName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          category: 'other',
          fieldCount: 0,
          description: `${collectionName.replace(/_/g, ' ')} collection`
        });
        continue;
      }

      // Count extractable fields
      const extractableFields = Object.entries(schema)
        .filter(([_, fieldDef]) => fieldDef.extractable === true);
      const fieldCount = extractableFields.length;

      // Create human-readable label
      const label = collectionName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Get category
      const category = this.getCategoryForCollection(collectionName);

      // Create concise description
      const description = this.generateConciseDescription(collectionName, category, fieldCount);

      lightweightTools.push({
        name: collectionName,
        label: label,
        category: category,
        fieldCount: fieldCount,
        description: description
      });
    }

    console.log(`✅ Built ${lightweightTools.length} lightweight tool descriptors`);
    return lightweightTools;
  }

  /**
   * Get category for a collection
   */
  getCategoryForCollection(collectionName) {
    // Collection categories for better organization
    const categories = {
      administrative: ['administrative_data', 'patient', 'patient_provider', 'facility'],
      clinical_basics: ['medications', 'allergies', 'diagnoses', 'problems', 'chief_complaints',
                        'history_present_illness', 'past_medical_history', 'family_history',
                        'social_history', 'immunizations'],
      vitals: ['vital_signs', 'physical_measurements', 'pain_scores'],
      labs: ['lab_results', 'lab_orders', 'chemistry_panel', 'hematology_results',
             'urinalysis_results', 'microbiology_reports', 'pathology_reports'],
      imaging: ['imaging_reports', 'radiology_reports', 'ct_reports', 'mri_reports',
                'xray_reports', 'ultrasound_reports', 'echo_reports'],
      procedures: ['medical_procedures', 'surgical_procedures', 'procedure_orders'],
      assessments: ['physical_exam_findings', 'review_of_systems', 'assessment_plans',
                    'progress_notes', 'discharge_summaries'],
      consultations: ['consultations', 'referrals', 'cardiology_consultations',
                      'pulmonology_consultations', 'endocrinology_consultations'],
      care_coordination: ['follow_up_appointments', 'emergency_information',
                          'care_coordination_notes', 'treatment_summary']
    };

    // Check category
    for (const [category, collections] of Object.entries(categories)) {
      if (collections.includes(collectionName)) {
        return category;
      }
    }

    // Infer category from collection name
    if (collectionName.includes('consultation') || collectionName.includes('assessment')) {
      return 'specialty_consultations';
    }
    if (collectionName.includes('report') || collectionName.includes('study')) {
      return 'diagnostic_reports';
    }
    if (collectionName.includes('medication') || collectionName.includes('prescription')) {
      return 'medications_orders';
    }
    return 'other';
  }

  /**
   * Generate concise 1-2 line description for a collection
   *
   * @param {string} collectionName - Collection name
   * @param {string} category - Collection category
   * @param {number} fieldCount - Number of extractable fields
   * @returns {string} Concise description
   */
  generateConciseDescription(collectionName, category, fieldCount) {
    // Mapping of common collections to descriptions
    const descriptions = {
      // Administrative
      administrative_data: `Administrative details: patient demographics, visit info, document metadata (${fieldCount} fields)`,
      patient: `Patient information: name, DOB, MRN, contact details (${fieldCount} fields)`,
      patient_provider: `Healthcare providers: physicians, nurses, specialists involved in care (${fieldCount} fields)`,

      // Clinical Basics
      medications: `Current and past medications: drug name, dose, frequency, indication, start/stop dates (${fieldCount} fields)`,
      allergies: `Drug and environmental allergies: allergen, reaction type, severity (${fieldCount} fields)`,
      diagnoses: `Medical diagnoses: condition, ICD code, status, risk factors, prognosis (${fieldCount} fields)`,
      problems: `Active problem list: ongoing conditions, chronic diseases (${fieldCount} fields)`,
      chief_complaints: `Primary reason for visit: patient's main concerns (${fieldCount} fields)`,
      history_present_illness: `HPI: symptom onset, progression, context, timeline (${fieldCount} fields)`,
      past_medical_history: `PMH: prior conditions, surgeries, hospitalizations (${fieldCount} fields)`,
      family_history: `Family history: hereditary conditions, genetic risks (${fieldCount} fields)`,
      social_history: `Social history: smoking, alcohol, occupation, living situation (${fieldCount} fields)`,
      immunizations: `Vaccination records: vaccine name, date, dose, site (${fieldCount} fields)`,

      // Vitals
      vital_signs: `Vital signs: BP, HR, temp, RR, SpO2, weight, BMI (${fieldCount} fields)`,
      physical_measurements: `Body measurements: height, weight, BMI, waist circumference (${fieldCount} fields)`,
      pain_scores: `Pain assessment: location, severity, characteristics (${fieldCount} fields)`,

      // Labs
      lab_results: `Laboratory results: test name, value, unit, reference range, date (${fieldCount} fields)`,
      lab_orders: `Lab orders: tests ordered, indication, urgency, collection date (${fieldCount} fields)`,
      chemistry_panel: `Chemistry labs: BMP, CMP, glucose, electrolytes, kidney/liver function (${fieldCount} fields)`,
      hematology_results: `Hematology: CBC, WBC differential, platelet count, hemoglobin (${fieldCount} fields)`,

      // Default template
      default: `${collectionName.replace(/_/g, ' ')}: Extract ${fieldCount} fields from medical document`
    };

    return descriptions[collectionName] || descriptions.default;
  }

  /**
   * Create Phase 1 system prompt for tool selection
   * Instructs Claude to select 20-40 relevant collections
   *
   * @returns {string} System prompt for Phase 1
   */
  createPhase1SystemPrompt() {
    return `You are a medical document analyzer. Your tasks are to:
1. Extract the patient's full name from the document
2. Select which medical data collections are relevant to extract

TASK 1 - PATIENT NAME (CRITICAL):
Extract the patient's full name EXACTLY as written in the document.
Look in these locations (in order):
  - Patient demographics section (usually at top of document)
  - Document header (may say "Patient:", "Name:", "Pt:")
  - Admission information or administrative section

TASK 2 - COLLECTION SELECTION:
Review the document and select 20-40 relevant collections that contain data present in this document.

GUIDELINES:
1. **Always include**: administrative_data, patient_provider (present in every document)
2. **NEVER include**: patient (patient data is handled separately by the system)
3. **Core clinical data**: Include if present: medications, allergies, diagnoses, vital_signs, lab_results
4. **Specialty-specific**: Only include specialty collections if document is from that specialty
5. **Be selective**: Don't select collections if document doesn't contain relevant data
6. **Aim for 20-40 total**: Too few = missed data, too many = wasted processing

SELECTION CRITERIA:
✓ Document explicitly mentions this type of data
✓ Multiple data points available to extract
✓ Clinically relevant to this visit/encounter
✗ Don't select if only vague mentions
✗ Don't select if no actual data to extract

USE THE TOOL: Once you've reviewed the document and identified relevant collections, call the "select_collections" tool with the list of collection names.

RESPONSE FORMAT:
Use the select_collections tool to return your selections:
{
  "selected_collections": ["administrative_data", "patient", "medications", "diagnoses", ...],
  "reasoning": "Brief explanation of why you selected these collections"
}`;
  }

  /**
   * Create the collection selection tool schema
   * This is the ONE tool Claude uses in Phase 1 to return selected collections
   *
   * @returns {object} Tool schema for collection selection
   */
  createCollectionSelectionTool() {
    return {
      name: "select_collections",
      description: "Select which medical data collections are relevant to extract from this document, AND extract the patient's name. Choose 20-40 collections that contain data actually present in the document.",
      input_schema: {
        type: "object",
        properties: {
          patient_name: {
            type: "string",
            description: "REQUIRED: The patient's full name from the document (format: 'First Last' or 'Last, First'). This is critical for identifying which patient to save the data to. Look in: patient demographics, admission info, header, or administrative section."
          },
          selected_collections: {
            type: "array",
            items: { type: "string" },
            description: "Array of collection names to extract (20-40 collections). Must be exact collection names from the provided list.",
            minItems: 15,
            maxItems: 50
          },
          reasoning: {
            type: "string",
            description: "Brief explanation (2-3 sentences) of why you selected these specific collections for this document."
          }
        },
        required: ["patient_name", "selected_collections", "reasoning"]
      }
    };
  }

  /**
   * Create Phase 1 batch request
   * Returns lightweight request for collection selection
   *
   * @param {object} document - Document to analyze
   * @param {string} practiceId - Practice ID
   * @returns {object} Phase 1 batch request
   */
  createPhase1BatchRequest(document, practiceId) {
    const lightweightTools = this.buildLightweightToolDescriptors();

    // Create collection catalog for Claude
    const collectionCatalog = lightweightTools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    const textPrompt = `Please analyze this medical document and select which collections are relevant to extract.

AVAILABLE COLLECTIONS (${lightweightTools.length} total):
${collectionCatalog}

SELECT 20-40 relevant collections and use the "select_collections" tool to return your selections.`;

    // Check if content is base64 PDF
    const isBase64PDF = typeof document.content === 'string' &&
                        (document.content.startsWith('JVBERi0') || // PDF magic bytes
                         document.contentType === 'application/pdf');

    // Build message content array (same format as Phase 2)
    let messageContent;
    if (isBase64PDF) {
      // PDF format for Claude - use document content block
      messageContent = [
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
      // Plain text format (for extracted text)
      messageContent = `${textPrompt}

DOCUMENT TO ANALYZE:
${document.content}`;
    }

    return {
      custom_id: `${practiceId}_phase1_${Date.now()}`,
      params: {
        model: 'claude-opus-4-8',  // Phase 1 makes ONE forced tool call - safe on 4.8 (no thinking param, no temperature: both rejected)
        max_tokens: 128000,  // 128K max output
        // Prompt caching: system prompt is identical for every document in the batch → cache it
        system: [{ type: 'text', text: this.createPhase1SystemPrompt(), cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        // Prompt caching: the collection-selection tool is identical for every document → cache it
        tools: [{ ...this.createCollectionSelectionTool(), cache_control: { type: 'ephemeral' } }],
        tool_choice: { type: 'tool', name: 'select_collections' }  // Force tool use
      }
    };
  }

  /**
   * Extract selected collections AND patient name from Phase 1 response
   *
   * @param {object} phase1Response - Batch API response from Phase 1
   * @returns {object} Object with collections array, patient_name, and reasoning
   */
  extractSelectedCollections(phase1Response) {
    try {
      const message = phase1Response.result?.message;
      if (!message || !message.content) {
        throw new Error('Invalid Phase 1 response format');
      }

      // Find tool use in content
      const toolUse = message.content.find(block => block.type === 'tool_use');
      if (!toolUse || toolUse.name !== 'select_collections') {
        throw new Error('No select_collections tool use found in response');
      }

      const selectedCollections = toolUse.input.selected_collections;
      const patientName = toolUse.input.patient_name;
      const reasoning = toolUse.input.reasoning;

      console.log(`✅ Phase 1: Claude selected ${selectedCollections.length} collections`);
      console.log(`👤 Patient Name: ${patientName || 'NOT FOUND'}`);
      console.log(`📝 Reasoning: ${reasoning}`);
      console.log(`📋 Selected: ${selectedCollections.slice(0, 10).join(', ')}...`);

      return {
        collections: selectedCollections,
        patientName: patientName,
        reasoning: reasoning,
        count: selectedCollections.length
      };
    } catch (error) {
      console.error('❌ Error extracting selected collections:', error.message);
      throw error;
    }
  }

  /**
   * ASYNC METHOD: Submit Phase 1 batch to select collections
   * Returns batch ID immediately, worker handles completion
   *
   * @param {Array} documents - Documents to analyze
   * @param {string} practiceId - Practice ID
   * @returns {string} Phase 1 batch ID
   */
  async selectCollections(documents, practiceId) {
    console.log('📤 Phase 1: Submitting batch for collection selection...');

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

    // Create Phase 1 batch requests (one per document)
    const requests = documents.map((doc, index) => {
      const request = this.createPhase1BatchRequest(doc, practiceId);
      request.custom_id = `${practiceId}_phase1_${Date.now()}_doc${index}`;
      return request;
    });

    console.log('📦 Phase 1: Submitting batch to Anthropic API with', requests.length, 'requests');

    // Use official Anthropic SDK for better compatibility
    const anthropic = new Anthropic({
      apiKey: apiKey,
      timeout: 60000, // 60 second timeout for batch creation
      maxRetries: 3
    });

    try {
      // 🛡️ COST CIRCUIT BREAKER: refuses submission above BATCH_MAX_COST_USD (default $10)
      const { assertBatchCostWithinBudget } = require('./batchCostGuard');
      assertBatchCostWithinBudget(requests, 'Phase 1');

      const batch = await anthropic.messages.batches.create({ requests });

      console.log(`✅ Phase 1 batch submitted: ${batch.id}`);
      console.log(`📊 Batch contains ${requests.length} document(s)`);
      console.log(`⏳ Status: ${batch.processing_status}`);

      return batch.id;
    } catch (error) {
      // CREDIT BALANCE RETRY: Wait and retry instead of crashing
      const isCreditError = error.message && error.message.includes('credit balance is too low');
      if (isCreditError) {
        const retryAttempt = (this._creditRetryCount || 0) + 1;
        const MAX_CREDIT_RETRIES = 10;
        const RETRY_DELAY_MS = 60000; // 1 minute

        if (retryAttempt <= MAX_CREDIT_RETRIES) {
          console.log(`💳 Credit balance too low — waiting ${RETRY_DELAY_MS / 1000}s before retry ${retryAttempt}/${MAX_CREDIT_RETRIES}...`);
          console.log(`   Add credits at https://console.anthropic.com/settings/billing`);
          // Notify user via WebSocket
          if (global.io) {
            global.io.emit('credit_balance_low', {
              type: 'credit_balance_low',
              message: `💳 Credit balance too low. Waiting 1 minute before retry ${retryAttempt}/${MAX_CREDIT_RETRIES}. Add credits at console.anthropic.com/settings/billing`,
              retryAttempt,
              maxRetries: MAX_CREDIT_RETRIES,
              nextRetryIn: RETRY_DELAY_MS,
              timestamp: new Date()
            });
          }
          this._creditRetryCount = retryAttempt;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          return this.selectCollections(documents, practiceId);
        } else {
          console.error(`❌ Credit balance still too low after ${MAX_CREDIT_RETRIES} retries. Giving up.`);
          if (global.io) {
            global.io.emit('credit_balance_low', {
              type: 'credit_balance_failed',
              message: `❌ Credit balance still too low after ${MAX_CREDIT_RETRIES} minutes. Document processing stopped. Please add credits and re-upload.`,
              timestamp: new Date()
            });
          }
          this._creditRetryCount = 0;
        }
      }

      console.error('❌ Phase 1 batch creation failed:', error.message);
      if (error.status) console.error('   HTTP Status:', error.status);
      if (error.error) console.error('   API Error:', JSON.stringify(error.error, null, 2));
      throw error;
    }
  }
}

module.exports = ClaudeBatchProcessorPhase1;
