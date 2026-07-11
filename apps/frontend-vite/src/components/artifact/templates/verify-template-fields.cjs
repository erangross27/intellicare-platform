#!/usr/bin/env node
/**
 * Template Field Verification Script
 *
 * Checks all templates to see which ones are using unified schema field names
 * vs legacy field names that don't exist in the schema.
 */

const fs = require('fs');
const path = require('path');

// Templates already verified as complete
const completedTemplates = [
  'LabResultsDocument.jsx',
  'MedicationsListDocument.jsx',
  'DiagnosesListDocument.jsx',
  'ImagingReportsDocument.jsx',
  'VitalSignsDocument.jsx',
  'AllergiesDocument.jsx',
  'PrescriptionsDocument.jsx'
];

// Get all template files
const templateDir = __dirname;
const templates = fs.readdirSync(templateDir)
  .filter(f => f.endsWith('Document.jsx'))
  .filter(f => !completedTemplates.includes(f))
  .sort();

console.log(`\n📊 TEMPLATE FIELD VERIFICATION REPORT`);
console.log(`═══════════════════════════════════════════════════════════════\n`);
console.log(`Total templates: 86`);
console.log(`Completed: ${completedTemplates.length}`);
console.log(`Remaining to check: ${templates.length}\n`);

// Load unified schemas
const schemaPath = path.join(__dirname, '../../../../../backend-api/services/unifiedMedicalSchemas.js');
let unifiedSchemas;
try {
  unifiedSchemas = require(schemaPath);
  console.log(`✅ Loaded unified schemas\n`);
} catch (err) {
  console.error(`❌ Failed to load unified schemas from ${schemaPath}`);
  console.error(err.message);
  process.exit(1);
}

// Helper to convert template name to collection name
function templateToCollection(templateName) {
  const name = templateName.replace(/Document\.jsx$/, '');
  // Convert camelCase/PascalCase to snake_case
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

// Check each template
const results = {
  verified: [],
  needsUpdate: [],
  noSchema: [],
  errors: []
};

for (const templateFile of templates) {
  const collectionName = templateToCollection(templateFile);

  try {
    // Get schema for this collection
    const schema = unifiedSchemas.getExtractionSchema(collectionName);

    if (!schema || Object.keys(schema).length === 0) {
      results.noSchema.push({ template: templateFile, collection: collectionName });
      continue;
    }

    // Read template file
    const templatePath = path.join(templateDir, templateFile);
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Extract field accesses (data.field, item.field, med.field, etc.)
    // This is a simple regex - not perfect but gives us a good indication
    const fieldPattern = /(?:data|item|med|consult|course|exam|test|result|study|assessment|record|doc|visit)\.([\w]+)/g;
    const matches = [...templateContent.matchAll(fieldPattern)];
    const fieldsUsed = new Set(matches.map(m => m[1]));

    // Get schema field names
    const schemaFields = new Set(Object.keys(schema));

    // Find fields used in template that are NOT in schema
    const missingFields = [...fieldsUsed].filter(f => !schemaFields.has(f));

    if (missingFields.length === 0) {
      results.verified.push({ template: templateFile, collection: collectionName });
    } else {
      results.needsUpdate.push({
        template: templateFile,
        collection: collectionName,
        missingFields: missingFields,
        schemaFields: [...schemaFields].slice(0, 10) // First 10 schema fields
      });
    }

  } catch (err) {
    results.errors.push({
      template: templateFile,
      collection: collectionName,
      error: err.message
    });
  }
}

// Print results
console.log(`\n✅ VERIFIED TEMPLATES (Already using unified schema):`);
console.log(`─────────────────────────────────────────────────────────────\n`);
results.verified.forEach((r, i) => {
  console.log(`${i + 1}. ${r.template} → ${r.collection}`);
});

console.log(`\n\n⚠️  TEMPLATES NEEDING UPDATES (Using legacy fields):`);
console.log(`─────────────────────────────────────────────────────────────\n`);
results.needsUpdate.forEach((r, i) => {
  console.log(`${i + 1}. ${r.template} → ${r.collection}`);
  console.log(`   Missing from schema: ${r.missingFields.slice(0, 5).join(', ')}${r.missingFields.length > 5 ? '...' : ''}`);
  console.log(`   Schema has: ${r.schemaFields.join(', ')}...\n`);
});

console.log(`\n📝 TEMPLATES WITHOUT SCHEMA:`);
console.log(`─────────────────────────────────────────────────────────────\n`);
results.noSchema.forEach((r, i) => {
  console.log(`${i + 1}. ${r.template} → ${r.collection} (no schema found)`);
});

if (results.errors.length > 0) {
  console.log(`\n\n❌ ERRORS:`);
  console.log(`─────────────────────────────────────────────────────────────\n`);
  results.errors.forEach((r, i) => {
    console.log(`${i + 1}. ${r.template}: ${r.error}`);
  });
}

// Summary
console.log(`\n\n═══════════════════════════════════════════════════════════════`);
console.log(`📊 SUMMARY:`);
console.log(`═══════════════════════════════════════════════════════════════\n`);
console.log(`✅ Verified (already good): ${results.verified.length}`);
console.log(`⚠️  Need updates: ${results.needsUpdate.length}`);
console.log(`📝 No schema: ${results.noSchema.length}`);
console.log(`❌ Errors: ${results.errors.length}`);
console.log(`\n📈 Progress: ${completedTemplates.length + results.verified.length}/86 complete\n`);

// Save detailed report
const reportPath = path.join(templateDir, 'template-field-verification-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  completed: completedTemplates,
  verified: results.verified,
  needsUpdate: results.needsUpdate,
  noSchema: results.noSchema,
  errors: results.errors
}, null, 2));

console.log(`💾 Detailed report saved to: template-field-verification-report.json\n`);
