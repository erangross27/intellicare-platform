/**
 * Claude Batch Processor with Tool Use Pattern
 *
 * PROOF OF CONCEPT - Implements Tool Use pattern for schema enforcement
 *
 * Key Benefits:
 * - 80%+ schema compliance (vs 14-20% failure with structured prompts)
 * - Forces Claude to use exact field names from unifiedMedicalSchemas
 * - Single tool per collection ensures consistent structure
 *
 * Based on web research (November 2025):
 * - Tool Use pattern most reliable for JSON schema compliance
 * - Anthropic SDK handles tool management natively
 * - Works with Batch API via tools + tool_choice parameters
 */

// Import singleton instance
const unifiedSchemas = require('./unifiedMedicalSchemas');

class ClaudeBatchProcessorToolUse {

  /**
   * Build extraction tool from unified schema
   * Converts unifiedMedicalSchemas format to Anthropic tool schema format
   *
   * @param {string} collectionName - Collection to extract data for
   * @returns {object} Anthropic tool schema with input_schema
   */
  buildExtractionTool(collectionName) {
    // Get extractable fields from unified schema
    const extractionSchema = unifiedSchemas.getExtractionSchema(collectionName);

    // Convert to Anthropic tool format
    const properties = {};
    const required = [];

    for (const [fieldName, fieldDef] of Object.entries(extractionSchema)) {
      // Build JSON Schema property with enhanced auto-descriptions
      let description = fieldDef.description;

      // If no description provided, generate contextual description
      if (!description || description === fieldName) {
        description = this.generateFieldDescription(fieldName, fieldDef.type, collectionName);
      }

      const property = {
        type: this.convertToJsonSchemaType(fieldDef.type),
        description: description
      };

      // Add examples if available
      if (fieldDef.example) {
        property.description += `. Example: ${fieldDef.example}`;
      }

      // Add enum values if specified
      if (fieldDef.enum) {
        property.enum = fieldDef.enum;
      }

      // Handle nested objects
      if (fieldDef.type === 'object' && fieldDef.properties) {
        property.properties = this.buildNestedProperties(fieldDef.properties);
      }

      // Handle arrays
      if (fieldDef.type === 'array' && fieldDef.items) {
        property.items = {
          type: this.convertToJsonSchemaType(fieldDef.items.type || 'object')
        };
        if (fieldDef.items.properties) {
          property.items.properties = this.buildNestedProperties(fieldDef.items.properties);
        }
      }

      properties[fieldName] = property;

      // Track required fields
      if (fieldDef.required) {
        required.push(fieldName);
      }
    }

    // AI Analysis Tools - These require GENERATION, not extraction
    const aiAnalysisDescriptions = {
      'gi_risk_assessment': '🤖 GENERATE (NOT EXTRACT) comprehensive GI risk assessment. When patient has multiple medications (especially NSAIDs+anticoagulants, NSAIDs+corticosteroids), you MUST create NEW analysis containing: (1) Bleeding risk with patient context, (2) Aspiration risk, (3) Hepatic risk, (4) Pancreatitis risk, (5) Overall risk score with recommendations. This is SYNTHESIS - review extracted medications/diagnoses/labs and generate clinical insights. CRITICAL: Fill EVERY field with your generated analysis.',

      'clinical_decision_support': '🤖 GENERATE clinical decision support recommendations based on extracted patient data. YOU create the recommendations by synthesizing clinical findings, not extract them from document. Fill EVERY field with your generated analysis.',

      'outcomes_prediction': '🤖 GENERATE outcome predictions based on clinical findings you extracted. Synthesize data to predict patient outcomes. This is analysis work - create predictions, not extract them. Fill EVERY field.',

      'medication_optimization': '🤖 GENERATE medication optimization recommendations by analyzing extracted medication list for interactions, duplicates, cost savings. Create optimization suggestions, not extract them. Fill EVERY field.',

      'suicide_risk_assessment': '🤖 GENERATE suicide risk assessment when psychiatric symptoms present. Analyze patient context to create risk stratification and recommendations. This is synthesis - create assessment, not extract it. Fill EVERY field.',

      'fall_risk_assessments': '🤖 GENERATE fall risk assessment when mobility/balance issues mentioned. Synthesize clinical data to assess fall risk and create recommendations. Create assessment, not extract it. Fill EVERY field.',

      'falls_prevention_program_assessment': '🤖 GENERATE fall risk assessment. Analyze patient factors to create comprehensive fall risk evaluation. This is synthesis work - generate assessment, not extract it. Fill EVERY field.',

      // NOTE: drug_interactions removed - it's a reference database (intellicare_drug_data.drug_interactions), not a patient collection
      // Phase 1 was selecting it but Phase 2 couldn't find schema, causing "No schema found" warnings

      'cardiovascular_risk_reduction': '🤖 GENERATE cardiovascular risk reduction recommendations based on patient data. Analyze clinical findings to create risk reduction strategies. Fill EVERY field.',

      'clinical_risk_scores': '🤖 GENERATE clinical risk scores by calculating from extracted patient data. Create risk stratification, not extract it. Fill EVERY field.',

      'homicide_risk_assessment': '🤖 GENERATE homicide risk assessment when relevant indicators present. Analyze patient context to create safety assessment. Fill EVERY field.',

      'pregnancy_risk_assessment': '🤖 GENERATE pregnancy risk assessment. Analyze maternal factors to create comprehensive risk evaluation. Fill EVERY field.',

      'infection_risk_monitoring': '🤖 GENERATE infection risk monitoring plan based on patient factors. Create monitoring recommendations, not extract them. Fill EVERY field.',

      'postpartum_diabetes_risk': '🤖 GENERATE postpartum diabetes risk assessment. Analyze maternal factors to create risk evaluation. Fill EVERY field.',

      'gdm_recurrence_risk': '🤖 GENERATE gestational diabetes recurrence risk assessment. Analyze patient history to create risk evaluation. Fill EVERY field.',

      'doctors_medications_recommendations_optimizations': '🤖 GENERATE medication recommendations and optimizations. Analyze medication regimen to create optimization suggestions. Fill EVERY field.'
    };

    // Enhanced description with field count and collection context
    let description = aiAnalysisDescriptions[collectionName];

    if (!description) {
      const fieldCount = Object.keys(properties).length;
      const collectionLabel = collectionName.replace(/_/g, ' ').toUpperCase();

      // Create field-aware description that emphasizes completeness
      description = `Extract ${collectionLabel} data (${fieldCount} fields available).

🎯 EXTRACTION GOAL: Fill ALL ${fieldCount} fields by searching the ENTIRE document.

📋 FIELD-BY-FIELD APPROACH:
• Review each of the ${fieldCount} parameters below
• Search the complete document for information to populate EACH field
• Check multiple sections: chief complaint, HPI, past medical history, social history, assessment/plan, medications, results
• Extract exact wording from document - never infer or fabricate
• Leave field empty ONLY if information truly doesn't exist

⚠️ CRITICAL: Claude tends to skip optional fields to save tokens. DON'T DO THIS. When you select this tool, you commit to extracting data for ALL ${fieldCount} fields. Incomplete extraction means the user loses valuable medical data.

✅ SUCCESS CRITERIA: Provide values for as many of the ${fieldCount} fields as the document contains. Aim for >80% field completion when document has relevant information.`;
    }


    // Return Anthropic tool format with enforcement instructions
    // NOTE: input_examples feature removed - caused type mismatch validation errors
    // (e.g., bmi: 25.1 number vs string schema, enum mismatches)
    return {
      name: `extract_${collectionName}`,
      description: description,
      input_schema: {
        type: "object",
        properties: properties,
        required: required.length > 0 ? required : undefined
      }
    };
  }

  /**
   * Generate contextual field description when schema doesn't provide one
   * Helps Claude understand WHAT to extract and WHERE to look
   */
  generateFieldDescription(fieldName, fieldType, collectionName) {
    // Common field descriptions across collections
    const commonDescriptions = {
      'date': 'Date in YYYY-MM-DD format - extract ONLY if explicitly stated, never infer or calculate',
      'provider': 'Provider name (e.g., "Dr. Smith, MD", "Sarah Johnson, NP")',
      'facility': 'Facility or hospital name where service was provided',
      'notes': 'Additional clinical notes or observations related to this entry',
      'findings': 'Clinical findings, observations, or results documented',
      'status': 'Current status (e.g., active, completed, pending, discontinued)',
      'name': 'Name or title - extract exact wording from document',
      'testName': 'Name of the test or study performed',
      'value': 'Test result value - extract exact value with units',
      'unit': 'Unit of measurement (e.g., mg/dL, mmHg, bpm)',
      'indication': 'Clinical indication or reason for this treatment/test/procedure',
      'complications': 'Any complications documented during or after the procedure',
      'outcome': 'Clinical outcome or result of the intervention',
      'technique': 'Technique or methodology used',
      'diagnosis': 'Complete diagnosis description as documented by provider',
      'icdCode': 'ICD-10 or ICD-9 diagnosis code if documented',
      'procedureName': 'Name of the procedure performed',
      'procedureType': 'Type or category of procedure',
      'imagingType': 'Type of imaging study (e.g., CT, MRI, X-ray, Ultrasound)',
      'bodyPart': 'Body part or anatomical region examined',
      'radiologist': 'Radiologist who interpreted the study',
      'impression': 'Radiologist\'s impression or conclusion',
      'comparison': 'Comparison to prior studies if documented',
      'criticalFindings': 'Any critical or urgent findings requiring immediate attention'
    };

    if (commonDescriptions[fieldName]) {
      return commonDescriptions[fieldName];
    }

    // Collection-specific contextual descriptions
    if (collectionName === 'medications') {
      const medDescriptions = {
        'dosage': 'Medication dose (e.g., "500mg", "10 units", "1 tablet") - extract exact dosage',
        'frequency': 'How often taken (e.g., "twice daily", "BID", "q8h", "PRN")',
        'genericName': 'Generic (non-brand) name of medication if documented',
        'startDate': 'Date medication was started (YYYY-MM-DD format) - ONLY if explicitly stated',
        'endDate': 'Date medication was stopped (YYYY-MM-DD format) - ONLY if explicitly stated',
        'duration': 'Duration of treatment (e.g., "10 days", "3 months", "ongoing")',
        'prescriber': 'Prescribing provider name',
        'refills': 'Number of refills authorized',
        'prn': 'True if medication is PRN (as needed), false if scheduled',
        'taperInstructions': 'Tapering schedule if documented (e.g., "decrease by 5mg weekly")',
        'durationDays': 'Total duration in days as a number',
        'durationUnit': 'Unit for duration (days, weeks, months, years)',
        'instructions': 'Specific patient instructions (e.g., "take with food", "avoid alcohol")',
        'active': 'True if medication is currently active, false if discontinued',
        'sideEffects': 'Documented side effects patient is experiencing'
      };
      if (medDescriptions[fieldName]) return medDescriptions[fieldName];
    }

    if (collectionName === 'lab_results') {
      const labDescriptions = {
        'specimenType': 'Type of specimen (e.g., blood, urine, serum, plasma)',
        'collectionDate': 'Date specimen was collected (YYYY-MM-DD)',
        'resultDate': 'Date results were reported (YYYY-MM-DD)',
        'methodology': 'Lab methodology or platform used',
        'deltaFromPrevious': 'Change from previous result if documented',
        'testType': 'Category of test (e.g., "Chemistry Panel", "CBC", "Urinalysis")',
        'orderingProvider': 'Provider who ordered the test',
        'labName': 'Name of laboratory that performed test',
        'results': 'Complete test results - extract all values',
        'criticalValues': 'Any critical or panic values requiring immediate attention',
        'interpretiveComments': 'Lab\'s interpretation or comments on results'
      };
      if (labDescriptions[fieldName]) return labDescriptions[fieldName];
    }

    if (collectionName === 'medical_procedures' || collectionName === 'surgical_procedures') {
      const procDescriptions = {
        'anesthesia': 'Type of anesthesia used (e.g., "general", "local", "conscious sedation")',
        'specimens': 'Any specimens collected during procedure',
        'implants': 'Any implants or devices placed during procedure'
      };
      if (procDescriptions[fieldName]) return procDescriptions[fieldName];
    }

    if (collectionName === 'imaging_reports') {
      const imagingDescriptions = {
        'contrast': 'Contrast agent used (e.g., "IV contrast", "oral contrast", "none")'
      };
      if (imagingDescriptions[fieldName]) return imagingDescriptions[fieldName];
    }

    // Fallback: Generate generic description from field name
    const readable = fieldName.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    return `${readable.charAt(0).toUpperCase() + readable.slice(1)} - search document for this information`;
  }

  /**
   * Generate realistic example value for a field based on its name and type
   * Used for input_examples in Anthropic's advanced tool use feature
   *
   * @param {string} fieldName - Name of the field
   * @param {string} fieldType - Type of the field (string, number, boolean, array, object)
   * @param {string} collectionName - Name of the collection for context
   * @param {object} fieldDef - Full field definition (optional, for array items with object type)
   * @returns {any} Example value appropriate for the field
   */
  generateExampleValue(fieldName, fieldType, collectionName, fieldDef = null) {
    // Common field examples (field name → realistic value)
    const commonExamples = {
      // Date fields
      'date': '2025-01-15',
      'startDate': '2025-01-10',
      'endDate': '2025-01-20',
      'dateOfDiagnosis': '2024-06-15',
      'admissionDate': '2025-01-08',
      'dischargeDate': '2025-01-12',
      'collectionDate': '2025-01-14',
      'resultDate': '2025-01-15',

      // Provider/Facility fields
      'provider': 'Dr. Sarah Johnson, MD',
      'prescriber': 'Dr. Michael Chen, MD',
      'orderingProvider': 'Dr. Emily Rodriguez, NP',
      'facility': 'Memorial General Hospital',
      'labName': 'Quest Diagnostics',
      'radiologist': 'Dr. James Wilson, MD',

      // Medication fields
      'name': 'Lisinopril',
      'genericName': 'lisinopril',
      'dosage': '20mg once daily',
      'frequency': 'once daily',
      'route': 'oral',
      'duration': '30 days',
      'indication': 'hypertension',
      'instructions': 'Take one tablet by mouth every morning with or without food',
      'quantity': '30 tablets',
      'refills': 3,
      'prn': false,
      'active': true,

      // Diagnosis fields
      'diagnosis': 'Type 2 Diabetes Mellitus, well-controlled',
      'icdCode': 'E11.9',
      'type': 'primary',
      'status': 'active',
      'stage': 'Stage II',
      'severity': 'moderate',
      'laterality': 'bilateral',

      // Clinical fields
      'findings': 'Patient presents with stable vital signs. No acute distress noted.',
      'assessment': 'Condition stable, responding well to current treatment regimen.',
      'plan': 'Continue current medications. Follow up in 4 weeks.',
      'notes': 'Patient compliant with medication regimen. No adverse effects reported.',
      'impression': 'No acute abnormality identified.',
      'recommendations': ['Continue current therapy', 'Follow up in 3 months', 'Monitor blood pressure weekly'],

      // Vital signs
      'bloodPressure': '128/82 mmHg',
      'heartRate': 72,
      'temperature': 98.6,
      'respiratoryRate': 16,
      'oxygenSaturation': 98,
      'weight': 175,
      'height': 70,
      'bmi': 25.1,
      'painScore': 2,

      // Lab fields
      'testName': 'Complete Blood Count',
      'testType': 'Hematology',
      'value': '14.2',
      'unit': 'g/dL',
      'referenceRange': '12.0-16.0 g/dL',
      'interpretation': 'Within normal limits',
      'specimenType': 'blood',

      // Procedure fields
      'procedureName': 'Colonoscopy',
      'procedureType': 'Diagnostic',
      'technique': 'Standard technique with conscious sedation',
      'anesthesia': 'conscious sedation',
      'complications': [],
      'outcome': 'Successful completion without complications',

      // Imaging fields
      'imagingType': 'CT Scan',
      'bodyPart': 'Abdomen and Pelvis',
      'contrast': 'IV contrast administered',
      'comparison': 'Compared to prior study dated 2024-06-01',
      'criticalFindings': 'None'
    };

    // Generate based on type first to handle special cases
    const jsonType = this.convertToJsonSchemaType(fieldType);

    // CRITICAL: For arrays with object items, always use schema-based generation
    // This prevents string arrays being returned for fields that expect object arrays
    // (e.g., recommendations: [{recommendation: '...', date: '...'}] NOT ['string1', 'string2'])
    if (jsonType === 'array' && fieldDef && fieldDef.items && fieldDef.items.type === 'object' && fieldDef.items.properties) {
      const itemExample = {};
      for (const [propName, propDef] of Object.entries(fieldDef.items.properties)) {
        itemExample[propName] = this.generateExampleValue(propName, propDef.type, collectionName, propDef);
      }
      return [itemExample];
    }

    // CRITICAL: Check for enum constraints BEFORE commonExamples
    // If field has enum, use first valid enum value instead of generic example
    // (e.g., allergenType enum ["drug","food","environmental","other"] should NOT return "primary")
    if (fieldDef && fieldDef.enum && Array.isArray(fieldDef.enum) && fieldDef.enum.length > 0) {
      return fieldDef.enum[0];
    }

    // Check for exact field name match (only for non-array-of-objects and non-enum fields)
    if (commonExamples[fieldName] !== undefined) {
      return commonExamples[fieldName];
    }

    switch (jsonType) {
      case 'string':
        // Try to infer from field name
        if (fieldName.toLowerCase().includes('date')) return '2025-01-15';
        if (fieldName.toLowerCase().includes('time')) return '14:30';
        if (fieldName.toLowerCase().includes('name')) return 'Example Name';
        if (fieldName.toLowerCase().includes('code')) return 'ABC123';
        if (fieldName.toLowerCase().includes('id')) return 'ID-12345';
        return 'Example value';

      case 'number':
      case 'integer':
        if (fieldName.toLowerCase().includes('count')) return 5;
        if (fieldName.toLowerCase().includes('score')) return 7;
        if (fieldName.toLowerCase().includes('level')) return 3;
        if (fieldName.toLowerCase().includes('rate')) return 72;
        return 10;

      case 'boolean':
        return true;

      case 'array':
        // NOTE: Array of objects is handled BEFORE the switch statement to ensure
        // schema-based generation takes precedence over hardcoded examples.
        // This case only handles simple arrays (arrays of strings/numbers).
        if (fieldName.toLowerCase().includes('medication')) return ['Lisinopril 20mg daily'];
        if (fieldName.toLowerCase().includes('diagnosis') || fieldName.toLowerCase().includes('diagnoses')) return ['Hypertension', 'Type 2 Diabetes'];
        if (fieldName.toLowerCase().includes('recommendation')) return ['Continue current therapy', 'Follow up in 2 weeks'];
        if (fieldName.toLowerCase().includes('complication')) return [];
        return ['Item 1', 'Item 2'];

      case 'object':
        return {};

      default:
        return 'Example';
    }
  }

  /**
   * Generate complete input_example for a collection from unified schema
   * This creates a realistic example that shows Claude how to use the tool
   *
   * @param {string} collectionName - Collection name
   * @param {object} extractionSchema - Schema from getExtractionSchema()
   * @returns {object} Complete example with all fields populated
   */
  generateInputExample(collectionName, extractionSchema) {
    const example = {};

    for (const [fieldName, fieldDef] of Object.entries(extractionSchema)) {
      // Pass full fieldDef to handle array items with object type
      example[fieldName] = this.generateExampleValue(fieldName, fieldDef.type, collectionName, fieldDef);
    }

    return example;
  }

  /**
   * Build nested properties recursively
   */
  buildNestedProperties(props) {
    const properties = {};
    for (const [name, def] of Object.entries(props)) {
      properties[name] = {
        type: this.convertToJsonSchemaType(def.type),
        description: def.description || name
      };
      if (def.properties) {
        properties[name].properties = this.buildNestedProperties(def.properties);
      }
    }
    return properties;
  }

  /**
   * Convert unified schema types to JSON Schema types
   */
  convertToJsonSchemaType(type) {
    const typeMap = {
      'ObjectId': 'string',
      'Date': 'string',
      'Mixed': 'object',
      'Buffer': 'string',
      'mixed': 'object'  // Handle lowercase 'mixed' from schema
    };

    // If type is in map, use mapped value
    if (typeMap[type]) {
      return typeMap[type];
    }

    // For remaining types, convert to lowercase
    const lowerType = type.toLowerCase();

    // Validate it's a valid JSON Schema type
    const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];

    if (validTypes.includes(lowerType)) {
      return lowerType;
    }

    // Default to 'string' for unknown types (safe fallback)
    console.warn(`⚠️ Unknown type "${type}" - defaulting to "string"`);
    return 'string';
  }

  /**
   * Create batch request with Tool Use pattern
   *
   * @param {string} documentText - Medical document text to extract from
   * @param {string} collectionName - Collection to extract into
   * @param {string} customId - Unique request identifier
   * @returns {object} Batch API request with tool enforcement
   */
  createToolUseRequest(documentText, collectionName, customId) {
    // Build extraction tool from unified schema
    const extractionTool = this.buildExtractionTool(collectionName);

    return {
      custom_id: customId,
      params: {
        model: 'claude-opus-4-6',  // Opus 4.6 - 1M context GA
        max_tokens: 20000,
        temperature: 0.0,  // Maximum determinism
        tools: [extractionTool],  // Single tool for this collection
        tool_choice: {
          type: "tool",
          name: extractionTool.name  // FORCE Claude to use this tool
        },
        messages: [
          {
            role: "user",
            content: `Extract ${collectionName} data from this medical document. Use the provided tool to structure the output.\n\nDocument:\n${documentText}`
          }
        ]
      }
    };
  }

  /**
   * EXAMPLE: Create batch request for outcomes_prediction
   */
  createOutcomesPredictionRequest(documentText, customId) {
    return this.createToolUseRequest(documentText, 'outcomes_prediction', customId);
  }
}

module.exports = ClaudeBatchProcessorToolUse;

/**
 * USAGE EXAMPLE:
 *
 * const toolProcessor = new ClaudeBatchProcessorToolUse();
 *
 * // Build tool for outcomes_prediction
 * const tool = toolProcessor.buildExtractionTool('outcomes_prediction');
 * console.log(JSON.stringify(tool, null, 2));
 *
 * // Create batch request
 * const request = toolProcessor.createOutcomesPredictionRequest(
 *   "Patient Angela Wright...",
 *   "batch_123"
 * );
 *
 * // Submit to Batch API (same as before, but with tools + tool_choice)
 * await anthropic.messages.batches.create({ requests: [request] });
 */
