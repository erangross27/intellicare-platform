const schema = require('./services/unified-medical-schemas.json');

const chunk1Collections = [
  'administrative_data',
  'patient_provider',
  'hospital_discharge_summaries',
  'discharge_summaries',
  'diagnoses',
  'medications',
  'prescriptions',
  'vital_signs',
  'lab_results',
  'allergies',
  'medical_procedures',
  'procedures'
];

console.log('=== CHUNK 1 SCHEMA ANALYSIS ===\n');

chunk1Collections.forEach((collectionName, idx) => {
  if (!schema[collectionName]) {
    console.log(`${idx + 1}. ${collectionName}: ❌ NOT FOUND IN SCHEMA\n`);
    return;
  }

  const fields = Object.keys(schema[collectionName]).filter(k =>
    !['_id', 'patientId', 'createdAt', 'updatedAt', 'source', 'aiProcessed'].includes(k)
  );

  console.log(`${idx + 1}. ${collectionName}: ${fields.length} extractable fields`);

  // Check if using generic template (has exactly these 11 fields)
  const genericFields = ['date', 'type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'recommendations', 'results', 'notes', 'status'];
  const hasGenericTemplate = genericFields.every(f => fields.includes(f)) && fields.length === 11;

  if (hasGenericTemplate) {
    console.log('   ⚠️  GENERIC TEMPLATE (11 fields): date, type, provider, facility, findings, assessment, plan, recommendations, results, notes, status');
  } else {
    console.log(`   Fields: ${fields.join(', ')}`);
  }
  console.log('');
});
