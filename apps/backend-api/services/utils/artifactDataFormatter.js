/**
 * Artifact Data Formatter
 *
 * Converts MongoDB medical data into human-readable text
 * that matches what users see in the artifact panel.
 *
 * Purpose: Give AI the EXACT context the user is viewing
 */

// Load collection-specific formatters
const collectionFormatters = require('./collectionFormatters');

class ArtifactDataFormatter {

  /**
   * Format artifact data based on navigation level
   * @param {Array|Object} data - MongoDB documents
   * @param {string} category - Collection name
   * @param {string} level - Navigation level (categories/documents/detail)
   * @returns {string|null} - Formatted text for AI prompt
   */
  formatArtifactData(data, category, level) {
    if (!data || level === 'categories') {
      return null; // No data needed at category level
    }

    if (level === 'documents') {
      return this.formatDocumentList(data, category);
    }

    if (level === 'detail') {
      // Single document detail view
      const doc = Array.isArray(data) ? data[0] : data;
      return this.formatDocument(doc, category);
    }

    if (level === 'document-collection') {
      // Document collection view - format ALL data as documents
      return this.formatDocumentData(data, category);
    }

    if (level === 'grid' || level === 'direct-grid') {
      // Grid view or direct-grid (ephemeral function results) - format as table/grid
      return this.formatGridData(data, category);
    }

    return null;
  }

  /**
   * Format grid data - Tabular format for grid views
   * Used for grid collections like patient lists, showing data in table format
   * @param {Array} records - Array of all grid records
   * @param {string} category - Collection name
   * @returns {string} - Formatted grid/table data
   */
  formatGridData(records, category) {
    if (!records || records.length === 0) {
      return `No ${category.replace(/_/g, ' ')} records found in the grid.`;
    }

    const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const lines = [`📊 ${categoryName} (Grid View)\n`];
    lines.push(`Showing ${records.length} record${records.length === 1 ? '' : 's'}:\n`);

    // Special formatting for specific grid types
    if (category === 'patients') {
      return this.formatPatientsGrid(records);
    }

    // Generic grid formatting - show key fields in table format
    records.forEach((record, index) => {
      lines.push(`\n${index + 1}. ${this.formatGridRecord(record, category)}`);
    });

    return lines.join('\n');
  }

  /**
   * Format patients grid specifically
   */
  formatPatientsGrid(patients) {
    const lines = ['📊 PATIENT LIST\n'];
    lines.push(`Total Patients: ${patients.length}\n`);
    lines.push('─'.repeat(80) + '\n');

    patients.forEach((patient, index) => {
      const name = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
      const age = patient.dateOfBirth ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / 31557600000) : '?';
      const gender = patient.gender || '?';
      const phone = patient.phoneNumber || patient.phone || 'N/A';
      const email = patient.email || 'N/A';

      lines.push(`${index + 1}. ${name}`);
      lines.push(`   Age: ${age} | Gender: ${gender}`);
      lines.push(`   Phone: ${phone}`);
      lines.push(`   Email: ${email}`);

      if (patient.medicalRecordNumber || patient.mrn) {
        lines.push(`   MRN: ${patient.medicalRecordNumber || patient.mrn}`);
      }

      if (patient.address) {
        lines.push(`   Address: ${patient.address}`);
      }

      lines.push(''); // Blank line between patients
    });

    return lines.join('\n');
  }

  /**
   * Format a single grid record
   */
  formatGridRecord(record, category) {
    // Get important fields based on category
    const importantFields = this.getImportantFields(record, category);
    const parts = [];

    for (const [key, value] of Object.entries(importantFields)) {
      if (value !== null && value !== undefined && value !== '') {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        parts.push(`${label}: ${value}`);
      }
    }

    return parts.join(' | ');
  }

  /**
   * Get important fields for grid display
   */
  getImportantFields(record, category) {
    const excludeFields = ['_id', 'practiceId', 'createdAt', 'updatedAt', '__v', 'password', 'passwordHash'];
    const important = {};

    // Category-specific important fields
    const categoryFields = {
      'appointments': ['patientName', 'date', 'time', 'reason', 'status', 'provider'],
      'medications': ['medicationName', 'dosage', 'frequency', 'status'],
      'lab_results': ['testName', 'value', 'unit', 'status', 'date'],
      'default': ['name', 'firstName', 'lastName', 'date', 'status', 'type']
    };

    const fieldsToShow = categoryFields[category] || categoryFields.default;

    // Extract important fields
    for (const field of fieldsToShow) {
      if (record[field]) {
        important[field] = record[field];
      }
    }

    // If no specific fields found, show first few non-excluded fields
    if (Object.keys(important).length === 0) {
      for (const [key, value] of Object.entries(record)) {
        if (!excludeFields.includes(key) && Object.keys(important).length < 5) {
          important[key] = value;
        }
      }
    }

    return important;
  }

  /**
   * Format document data - ALL records formatted as full documents
   * Used for document-collection views (unified medical documents)
   * @param {Array} documents - Array of all documents
   * @param {string} category - Collection name
   * @returns {string} - Formatted document data
   */
  formatDocumentData(documents, category) {
    if (!documents || documents.length === 0) {
      return `No ${category.replace(/_/g, ' ')} records found.`;
    }

    const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const lines = [`📋 ${categoryName}\n`];
    lines.push(`Displaying ${documents.length} record${documents.length === 1 ? '' : 's'}:\n`);

    // Format each document with full data
    documents.forEach((doc, index) => {
      lines.push(`\n--- Record ${index + 1} ---`);

      // CRITICAL: Check if this is a unified document (has documentData field)
      // If so, extract the actual medical data from documentData
      const dataToFormat = doc.documentData ? doc.documentData : doc;

      // Format document data exactly as it appears
      const formatted = this.formatByCategory(dataToFormat, category);
      lines.push(formatted);
    });

    return lines.join('\n');
  }

  /**
   * Format a list of documents (summary view)
   * @param {Array} documents - Array of documents
   * @param {string} category - Collection name
   * @returns {string} - Formatted list
   */
  formatDocumentList(documents, category) {
    if (!documents || documents.length === 0) {
      return `No ${category.replace(/_/g, ' ')} records found.`;
    }

    const lines = [`User is viewing a list of ${documents.length} ${category.replace(/_/g, ' ')} records:\n`];

    documents.forEach((doc, index) => {
      const date = this.formatDate(doc.date || doc.createdAt || doc.timestamp);
      const title = this.getDocumentTitle(doc, category);
      lines.push(`${index + 1}. ${title} - ${date}`);
    });

    return lines.join('\n');
  }

  /**
   * Format a single document for detail view
   * @param {Object} doc - MongoDB document
   * @param {string} category - Collection name
   * @returns {string} - Formatted document
   */
  formatDocument(doc, category) {
    if (!doc) return 'No document data available.';

    const lines = [];
    const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    lines.push(`=== ${categoryName} ===\n`);

    // CRITICAL: Check if this is a unified document (has documentData field)
    // If so, extract the actual medical data from documentData
    const dataToFormat = doc.documentData ? doc.documentData : doc;

    // Add date if available (check both outer doc and inner documentData)
    const dateField = dataToFormat.date || dataToFormat.documentDate || doc.documentDate || dataToFormat.createdAt || dataToFormat.timestamp;
    if (dateField) {
      lines.push(`Date: ${this.formatDate(dateField)}`);
    }

    // Format based on category type
    const formatted = this.formatByCategory(dataToFormat, category);
    lines.push(formatted);

    return lines.join('\n');
  }

  /**
   * Format document based on specific category type
   * @param {Object} doc - Document data
   * @param {string} category - Collection name
   * @returns {string} - Formatted content
   */
  formatByCategory(doc, category) {
    // PRIORITY 1: Check for collection-specific formatter in collectionFormatters/ folder
    if (collectionFormatters[category]) {
      console.log(`✅ [FORMATTER] Using NEW collection-specific formatter: ${category}.js`);
      return collectionFormatters[category](doc);
    }

    // PRIORITY 2: Fallback to legacy inline formatters (will be migrated to folder over time)
    const legacyFormatters = {
      'allergy_assessments': this.formatAllergyAssessment.bind(this),
      'allergies': this.formatAllergy.bind(this),
      'diagnoses': this.formatDiagnosis.bind(this),
      'clinical_decision_support': this.formatClinicalDecisionSupport.bind(this),
      'intelligent_recommendations': this.formatIntelligentRecommendations.bind(this),
      'trending_analysis': this.formatTrendingAnalysis.bind(this)
    };

    const formatter = legacyFormatters[category];
    if (formatter) {
      console.log(`⚠️  [FORMATTER] Using LEGACY inline formatter: ${category}`);
      return formatter(doc);
    }

    // PRIORITY 3: Generic formatter for collections without specific formatters yet
    console.log(`📝 [FORMATTER] Using GENERIC formatter: ${category}`);
    return this.formatGeneric(doc);
  }

  /**
   * Format allergy assessment
   */
  formatAllergyAssessment(doc) {
    const lines = [];

    if (doc.allergen) lines.push(`Allergen: ${doc.allergen}`);
    if (doc.severity) lines.push(`Severity: ${doc.severity}`);
    if (doc.reaction) lines.push(`Reaction: ${doc.reaction}`);
    if (doc.dateIdentified) lines.push(`Date Identified: ${this.formatDate(doc.dateIdentified)}`);
    if (doc.notes) lines.push(`Notes: ${doc.notes}`);
    if (doc.managementPlan) lines.push(`Management: ${doc.managementPlan}`);

    return lines.join('\n');
  }

  /**
   * Format allergy
   */
  formatAllergy(doc) {
    const lines = [];

    if (doc.allergyName || doc.allergen) lines.push(`Allergen: ${doc.allergyName || doc.allergen}`);
    if (doc.severity) lines.push(`Severity: ${doc.severity}`);
    if (doc.reaction || doc.reactions) {
      const reactions = Array.isArray(doc.reactions) ? doc.reactions.join(', ') : doc.reaction;
      lines.push(`Reactions: ${reactions}`);
    }
    if (doc.onsetDate) lines.push(`Onset: ${this.formatDate(doc.onsetDate)}`);
    if (doc.notes || doc.comments) lines.push(`Notes: ${doc.notes || doc.comments}`);

    return lines.join('\n');
  }

  /**
   * Format medication
   */
  formatMedication(doc) {
    const lines = [];

    if (doc.medicationName || doc.name) lines.push(`Medication: ${doc.medicationName || doc.name}`);
    if (doc.dosage) lines.push(`Dosage: ${doc.dosage}`);
    if (doc.frequency) lines.push(`Frequency: ${doc.frequency}`);
    if (doc.route) lines.push(`Route: ${doc.route}`);
    if (doc.startDate) lines.push(`Started: ${this.formatDate(doc.startDate)}`);
    if (doc.endDate) lines.push(`End Date: ${this.formatDate(doc.endDate)}`);
    if (doc.prescribedBy) lines.push(`Prescribed By: ${doc.prescribedBy}`);
    if (doc.reason || doc.indication) lines.push(`Reason: ${doc.reason || doc.indication}`);
    if (doc.instructions) lines.push(`Instructions: ${doc.instructions}`);

    return lines.join('\n');
  }

  /**
   * Format lab result
   */
  formatLabResult(doc) {
    const lines = [];

    if (doc.testName) lines.push(`Test: ${doc.testName}`);
    if (doc.value !== undefined) {
      const unit = doc.unit ? ` ${doc.unit}` : '';
      lines.push(`Result: ${doc.value}${unit}`);
    }
    if (doc.referenceRange) lines.push(`Reference Range: ${doc.referenceRange}`);
    if (doc.status || doc.abnormalFlag) {
      const status = doc.abnormalFlag || doc.status;
      lines.push(`Status: ${status}`);
    }
    if (doc.performedDate) lines.push(`Date Performed: ${this.formatDate(doc.performedDate)}`);
    if (doc.interpretation) lines.push(`Interpretation: ${doc.interpretation}`);

    return lines.join('\n');
  }

  /**
   * Format diagnosis
   */
  formatDiagnosis(doc) {
    const lines = [];

    if (doc.diagnosis || doc.condition) lines.push(`Diagnosis: ${doc.diagnosis || doc.condition}`);
    if (doc.icd10Code) lines.push(`ICD-10: ${doc.icd10Code}`);
    if (doc.type) lines.push(`Type: ${doc.type}`);
    if (doc.status) lines.push(`Status: ${doc.status}`);
    if (doc.onsetDate) lines.push(`Onset: ${this.formatDate(doc.onsetDate)}`);
    if (doc.diagnosedBy) lines.push(`Diagnosed By: ${doc.diagnosedBy}`);
    if (doc.notes) lines.push(`Notes: ${doc.notes}`);

    return lines.join('\n');
  }

  /**
   * Format clinical decision support (AI-generated)
   */
  formatClinicalDecisionSupport(doc) {
    const lines = [];

    if (doc.riskAssessment) {
      lines.push(`\nRisk Assessment:`);
      if (typeof doc.riskAssessment === 'string') {
        lines.push(doc.riskAssessment);
      } else {
        lines.push(this.formatObject(doc.riskAssessment));
      }
    }

    if (doc.redFlags && doc.redFlags.length > 0) {
      lines.push(`\nRed Flags:`);
      doc.redFlags.forEach(flag => lines.push(`  • ${flag}`));
    }

    if (doc.drugInteractions && doc.drugInteractions.length > 0) {
      lines.push(`\nDrug Interactions:`);
      doc.drugInteractions.forEach(interaction => {
        if (typeof interaction === 'string') {
          lines.push(`  • ${interaction}`);
        } else {
          lines.push(`  • ${interaction.description || JSON.stringify(interaction)}`);
        }
      });
    }

    if (doc.contraindications && doc.contraindications.length > 0) {
      lines.push(`\nContraindications:`);
      doc.contraindications.forEach(contra => lines.push(`  • ${contra}`));
    }

    return lines.join('\n');
  }

  /**
   * Format intelligent recommendations (AI-generated)
   */
  formatIntelligentRecommendations(doc) {
    const lines = [];

    if (doc.immediate && doc.immediate.length > 0) {
      lines.push(`\nImmediate Actions:`);
      doc.immediate.forEach(action => {
        if (typeof action === 'string') {
          lines.push(`  • ${action}`);
        } else {
          lines.push(`  • ${action.action || action.recommendation}`);
          if (action.rationale) lines.push(`    Rationale: ${action.rationale}`);
        }
      });
    }

    if (doc.shortTerm && doc.shortTerm.length > 0) {
      lines.push(`\nShort-term Recommendations:`);
      doc.shortTerm.forEach(rec => {
        lines.push(`  • ${typeof rec === 'string' ? rec : rec.recommendation}`);
      });
    }

    if (doc.longTerm && doc.longTerm.length > 0) {
      lines.push(`\nLong-term Recommendations:`);
      doc.longTerm.forEach(rec => {
        lines.push(`  • ${typeof rec === 'string' ? rec : rec.recommendation}`);
      });
    }

    if (doc.preventive && doc.preventive.length > 0) {
      lines.push(`\nPreventive Measures:`);
      doc.preventive.forEach(measure => {
        lines.push(`  • ${typeof measure === 'string' ? measure : measure.measure}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format trending analysis (AI-generated)
   */
  formatTrendingAnalysis(doc) {
    const lines = [];

    if (doc.vitalSignsTrends) {
      lines.push(`\nVital Signs Trends:`);
      lines.push(this.formatObject(doc.vitalSignsTrends));
    }

    if (doc.labTrends) {
      lines.push(`\nLab Result Trends:`);
      lines.push(this.formatObject(doc.labTrends));
    }

    if (doc.diseaseProgression) {
      lines.push(`\nDisease Progression:`);
      lines.push(typeof doc.diseaseProgression === 'string' ? doc.diseaseProgression : this.formatObject(doc.diseaseProgression));
    }

    return lines.join('\n');
  }

  /**
   * Format Follow-Up Intelligence
   */
  formatFollowUpIntelligence(doc) {
    const lines = [];

    // DEBUG: Log what we're formatting
    console.log(`🔍 [FORMATTER DEBUG] formatFollowUpIntelligence called`);
    console.log(`   → deadlines:`, doc.deadlines?.length || 0, 'items');
    console.log(`   → prioritization:`, doc.prioritization?.length || 0, 'items');
    console.log(`   → coordinationNeeds:`, doc.coordinationNeeds?.length || 0, 'items');

    // Handle both 'deadlines' and 'upcomingDeadlines' field names
    const deadlines = doc.deadlines || doc.upcomingDeadlines || [];
    if (deadlines.length > 0) {
      lines.push(`\n📅 Upcoming Deadlines (${deadlines.length}):`);
      deadlines.forEach((deadline, idx) => {
        lines.push(`\n${idx + 1}. ${deadline.item || deadline.testName || deadline.name || 'Follow-up item'}`);
        if (deadline.criticality) lines.push(`   Priority: ${deadline.criticality}`);
        if (deadline.priority) lines.push(`   Priority: ${deadline.priority}`);
        if (deadline.dueDate) lines.push(`   Due: ${this.formatDate(deadline.dueDate)}`);
        if (deadline.consequences) lines.push(`   Consequences: ${deadline.consequences}`);
        if (deadline.consequencesIfMissed) lines.push(`   Consequences: ${deadline.consequencesIfMissed}`);
        if (deadline.autoSchedule !== undefined) lines.push(`   Auto-schedule: ${deadline.autoSchedule}`);
        if (deadline.autoScheduleRecommendation) lines.push(`   Auto-schedule: ${deadline.autoScheduleRecommendation}`);
      });
    }

    // Add prioritization section
    if (doc.prioritization && doc.prioritization.length > 0) {
      lines.push(`\n\n📋 Prioritization (${doc.prioritization.length} tasks):`);
      doc.prioritization.forEach((task, idx) => {
        lines.push(`\n${task.priority || idx + 1}. ${task.task}`);
        if (task.urgency) lines.push(`   Urgency: ${task.urgency}`);
        if (task.importance) lines.push(`   Importance: ${task.importance}`);

        // Add dependencies (critical for task sequencing)
        if (task.dependencies && task.dependencies.length > 0) {
          lines.push(`   Dependencies: ${task.dependencies.join(', ')}`);
        }
      });
    }

    // Add coordination needs
    if (doc.coordinationNeeds && doc.coordinationNeeds.length > 0) {
      lines.push(`\n\n👥 Coordination Needs (${doc.coordinationNeeds.length} specialists):`);
      doc.coordinationNeeds.forEach((coord, idx) => {
        lines.push(`\n${idx + 1}. ${coord.specialist}`);
        if (coord.urgency) lines.push(`   Urgency: ${coord.urgency}`);
        if (coord.reason) lines.push(`   Reason: ${coord.reason}`);

        // Add information needed (critical for care coordination)
        if (coord.informationNeeded && coord.informationNeeded.length > 0) {
          lines.push(`   Information Needed:`);
          coord.informationNeeded.forEach(info => {
            lines.push(`     - ${info}`);
          });
        }

        // Add expected outcome if present
        if (coord.expectedOutcome) lines.push(`   Expected Outcome: ${coord.expectedOutcome}`);
      });
    }

    if (doc.otherMedicalConditions && doc.otherMedicalConditions.length > 0) {
      lines.push(`\n\n🏥 Other Medical Conditions:`);
      doc.otherMedicalConditions.forEach(condition => {
        lines.push(`  • ${condition}`);
      });
    }

    if (doc.summary) {
      lines.push(`\n\n📋 Summary: ${doc.summary}`);
    }

    const result = lines.join('\n');
    console.log(`🔍 [FORMATTER DEBUG] Output length: ${result.length} chars`);
    console.log(`🔍 [FORMATTER DEBUG] First 500 chars:`, result.substring(0, 500));

    return result;
  }

  /**
   * Generic formatter for unknown collection types
   */
  formatGeneric(doc) {
    const lines = [];
    const excludeFields = ['_id', 'patientId', 'documentId', 'practiceId', 'createdAt', 'updatedAt', '__v'];

    for (const [key, value] of Object.entries(doc)) {
      if (excludeFields.includes(key) || value === null || value === undefined) {
        continue;
      }

      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

      if (Array.isArray(value)) {
        if (value.length > 0) {
          // Check if all items are simple strings/numbers
          const allSimple = value.every(item => typeof item !== 'object');
          if (allSimple) {
            lines.push(`${label}: ${value.join(', ')}`);
          } else {
            // Complex objects in array - format each on separate line
            lines.push(`${label}:`);
            value.forEach((item, idx) => {
              if (typeof item === 'object') {
                lines.push(`  ${idx + 1}. ${this.formatInlineObject(item)}`);
              } else {
                lines.push(`  • ${item}`);
              }
            });
          }
        }
      } else if (typeof value === 'object') {
        lines.push(`${label}:`);
        lines.push(this.formatObject(value, '  '));
      } else {
        lines.push(`${label}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format object inline (single line for array items)
   */
  formatInlineObject(obj) {
    if (!obj || typeof obj !== 'object') return String(obj);

    const parts = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || key === '_id') continue;

      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

      if (Array.isArray(value)) {
        parts.push(`${label}: ${value.join(', ')}`);
      } else if (typeof value === 'object') {
        // Nested object - format recursively
        parts.push(`${label}: {${this.formatInlineObject(value)}}`);
      } else {
        parts.push(`${label}: ${value}`);
      }
    }
    return parts.join(', ');
  }

  /**
   * Format nested object (multi-line for nested structures)
   */
  formatObject(obj, indent = '') {
    if (!obj || typeof obj !== 'object') return String(obj);

    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || key === '_id') continue;

      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

      if (Array.isArray(value)) {
        lines.push(`${indent}${label}: ${value.join(', ')}`);
      } else if (typeof value === 'object') {
        lines.push(`${indent}${label}:`);
        lines.push(this.formatObject(value, indent + '  '));
      } else {
        lines.push(`${indent}${label}: ${value}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Format date to readable string
   */
  formatDate(dateValue) {
    if (!dateValue) return 'Unknown date';

    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Invalid date';

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (err) {
      return 'Unknown date';
    }
  }

  /**
   * Get document title for list view
   */
  getDocumentTitle(doc, category) {
    // Try to find a meaningful title field
    const titleFields = [
      'title', 'name', 'testName', 'diagnosis', 'condition',
      'medicationName', 'allergen', 'allergyName', 'procedureName'
    ];

    for (const field of titleFields) {
      if (doc[field]) return doc[field];
    }

    // Fallback to category name
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

module.exports = new ArtifactDataFormatter();
