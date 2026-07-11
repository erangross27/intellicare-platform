const schema = require('./services/unified-medical-schemas.json');

const genericFields = ['date', 'type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'recommendations', 'results', 'notes', 'status'];

const collectionsWithGenericTemplate = [];
const collectionsWithSpecializedSchema = [];

Object.keys(schema).forEach(collectionName => {
  const fields = Object.keys(schema[collectionName]).filter(k =>
    !['_id', 'patientId', 'createdAt', 'updatedAt', 'source', 'aiProcessed'].includes(k)
  );

  // Check if EXACTLY these 11 generic fields (and only these)
  const hasGenericTemplate = genericFields.every(f => fields.includes(f)) && fields.length === 11;

  if (hasGenericTemplate) {
    collectionsWithGenericTemplate.push(collectionName);
  } else {
    collectionsWithSpecializedSchema.push(collectionName);
  }
});

console.log('=== GENERIC TEMPLATE COLLECTIONS (11 fields) ===');
console.log(`Total: ${collectionsWithGenericTemplate.length} collections\n`);

collectionsWithGenericTemplate.forEach((name, idx) => {
  console.log(`${idx + 1}. ${name}`);
});

console.log(`\n=== SPECIALIZED SCHEMA COLLECTIONS ===`);
console.log(`Total: ${collectionsWithSpecializedSchema.length} collections\n`);

console.log('=== SUMMARY ===');
console.log(`Generic templates: ${collectionsWithGenericTemplate.length}`);
console.log(`Specialized schemas: ${collectionsWithSpecializedSchema.length}`);
console.log(`Total collections: ${Object.keys(schema).length}`);
