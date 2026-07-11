/**
 * Import Official Billing Codes from CMS/CDC into MongoDB
 *
 * Sources:
 * - ICD-10-CM 2026: CDC/CMS (74,719 diagnosis codes) - Public domain
 * - CPT 2026: CMS Medicare Physician Fee Schedule RVU file (9,802 procedure codes)
 * - HCPCS Level II 2026: CMS (8,623 supply/service codes) - Public use file
 *
 * Creates database: intellicare_billing_codes
 * Collections: icd10_codes, cpt_codes, hcpcs_codes
 *
 * Run: node apps/backend-api/scripts/importOfficialBillingCodes.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'intellicare_billing_codes';

// File paths - downloaded from CDC/CMS
const DATA_DIR = path.join(__dirname, '../../../data/billing-codes');
const ICD10_FILE = path.join(DATA_DIR, 'icd10cm-codes-2026.txt');
const CPT_RVU_FILE = path.join(DATA_DIR, 'PPRRVU2026_Jan_nonQPP.csv');
const HCPCS_FILE = path.join(DATA_DIR, 'HCPC2026_JAN_ANWEB_01122026.txt');

/**
 * Parse ICD-10-CM codes file from CDC
 * Format: CODE    DESCRIPTION (no dots in code, 2+ spaces separator)
 */
function parseICD10File(filePath) {
  console.log(`\nParsing ICD-10-CM file: ${filePath}`);
  const data = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
  const lines = data.split('\n').filter(l => l.trim());
  const codes = [];

  for (const line of lines) {
    // Code + 1 or more spaces + description (fixed-width: code field ~8 chars)
    const match = line.match(/^([A-Z]\d[\dA-Z]{1,6})\s+(.+)$/);
    if (match) {
      const rawCode = match[1];
      // Insert dot after 3rd character: A000 -> A00.0, E119 -> E11.9, C441021 -> C44.1021
      const code = rawCode.length > 3 ? rawCode.slice(0, 3) + '.' + rawCode.slice(3) : rawCode;
      const description = match[2].trim();

      let category = 'Other';
      const ch = code.charAt(0);
      if (ch >= 'A' && ch <= 'B') category = 'Infectious Diseases';
      else if (ch === 'C' || (ch === 'D' && code < 'D50')) category = 'Neoplasms';
      else if (ch === 'D') category = 'Blood Diseases';
      else if (ch === 'E') category = 'Endocrine/Metabolic';
      else if (ch === 'F') category = 'Mental/Behavioral';
      else if (ch === 'G') category = 'Nervous System';
      else if (ch === 'H' && code < 'H60') category = 'Eye/Adnexa';
      else if (ch === 'H') category = 'Ear/Mastoid';
      else if (ch === 'I') category = 'Circulatory';
      else if (ch === 'J') category = 'Respiratory';
      else if (ch === 'K') category = 'Digestive';
      else if (ch === 'L') category = 'Skin/Subcutaneous';
      else if (ch === 'M') category = 'Musculoskeletal';
      else if (ch === 'N') category = 'Genitourinary';
      else if (ch === 'O') category = 'Pregnancy';
      else if (ch === 'P') category = 'Perinatal';
      else if (ch === 'Q') category = 'Congenital';
      else if (ch === 'R') category = 'Symptoms/Signs';
      else if (ch === 'S' || ch === 'T') category = 'Injury/Poisoning';
      else if (ch === 'V' || ch === 'W' || ch === 'X' || ch === 'Y') category = 'External Causes';
      else if (ch === 'Z') category = 'Health Status/Services';
      else if (ch === 'U') category = 'Special Purpose';

      codes.push({
        code,
        codeNoDecimal: rawCode,
        type: 'ICD-10-CM',
        description,
        category,
        version: '2026',
        source: 'CDC/CMS'
      });
    }
  }

  console.log(`  Parsed ${codes.length} ICD-10-CM codes`);
  return codes;
}

/**
 * Parse CPT codes from Medicare Physician Fee Schedule RVU CSV file
 * Format: HCPCS,MOD,DESCRIPTION,CODE,PAYMENT,...,RVU fields...
 */
function parseCPTFile(filePath) {
  console.log(`\nParsing CPT/RVU file: ${filePath}`);
  const data = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
  const lines = data.split('\n');
  const codes = [];
  const seen = new Set();

  for (const line of lines) {
    // Skip header/comment lines - data lines start with a code
    if (!line.match(/^\d{5}[A-Z]?,/)) continue;

    const fields = line.split(',');
    const code = fields[0];
    const modifier = fields[1];
    const description = fields[2] || '';
    const statusCode = fields[3] || '';

    // Skip modifier-specific entries - only keep base codes
    if (modifier) continue;
    // Skip duplicates
    if (seen.has(code)) continue;
    seen.add(code);

    // Parse RVU values
    const workRVU = parseFloat(fields[5]) || 0;
    const peRVU = parseFloat(fields[8]) || 0;
    const mpRVU = parseFloat(fields[10]) || 0;
    const totalRVU = parseFloat(fields[12]) || 0;
    const globalPeriod = fields[14] || '';

    // Determine category from code range
    const num = parseInt(code);
    let category = 'Other';
    if (num >= 99201 && num <= 99499) category = 'E&M';
    else if (num >= 10000 && num <= 69990) category = 'Surgery';
    else if (num >= 70000 && num <= 79999) category = 'Radiology';
    else if (num >= 80000 && num <= 89999) category = 'Pathology/Lab';
    else if (num >= 90000 && num <= 99199) category = 'Medicine';
    else if (num >= 100 && num <= 1999) category = 'Anesthesia';
    else if (code.endsWith('F')) category = 'Performance Measures';
    else if (code.endsWith('T')) category = 'Temporary';
    else if (code.endsWith('U')) category = 'PLA';

    codes.push({
      code,
      type: 'CPT',
      description,
      category,
      statusCode,
      workRVU,
      practiceExpenseRVU: peRVU,
      malpracticeRVU: mpRVU,
      totalRVU,
      globalPeriod,
      version: '2026',
      source: 'CMS Medicare PFS'
    });
  }

  console.log(`  Parsed ${codes.length} CPT codes`);

  // Show category breakdown
  const cats = {};
  codes.forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1; });
  Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`    ${cat}: ${count}`);
  });

  return codes;
}

/**
 * Parse HCPCS Level II file (fixed-width format from CMS)
 * Only record type 3 (procedure first line) + type 4 (continuations)
 */
function parseHCPCSFile(filePath) {
  console.log(`\nParsing HCPCS Level II file: ${filePath}`);
  const data = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
  const lines = data.split('\n').filter(l => l.trim());
  const codes = [];
  const continuations = new Map();

  for (const line of lines) {
    if (line.length < 92) continue;

    const code = line.substring(0, 5).trim();
    const recType = line.charAt(10);
    const longDesc = line.substring(11, 91).trim();
    const shortDesc = line.substring(91, 119).trim();

    if (recType === '3') {
      const prefix = code.charAt(0);
      let category = 'Other';
      if (prefix === 'A') category = 'Transport/Medical Supplies';
      else if (prefix === 'B') category = 'Enteral/Parenteral';
      else if (prefix === 'C') category = 'Outpatient PPS';
      else if (prefix === 'D') category = 'Dental';
      else if (prefix === 'E') category = 'DME';
      else if (prefix === 'G') category = 'Procedures/Services';
      else if (prefix === 'H') category = 'Behavioral Health';
      else if (prefix === 'J') category = 'Drugs (Non-Oral)';
      else if (prefix === 'K') category = 'DME (Temporary)';
      else if (prefix === 'L') category = 'Orthotics/Prosthetics';
      else if (prefix === 'M') category = 'Quality Measures';
      else if (prefix === 'P') category = 'Pathology/Lab';
      else if (prefix === 'Q') category = 'Miscellaneous Services';
      else if (prefix === 'R') category = 'Diagnostic Radiology';
      else if (prefix === 'S') category = 'Private Payer';
      else if (prefix === 'T') category = 'State Medicaid';
      else if (prefix === 'U') category = 'Coronavirus Services';
      else if (prefix === 'V') category = 'Vision/Hearing';

      codes.push({
        code,
        type: 'HCPCS',
        description: longDesc,
        shortDescription: shortDesc,
        category,
        version: '2026',
        source: 'CMS'
      });

      continuations.set(code, codes.length - 1);
    } else if (recType === '4') {
      const idx = continuations.get(code);
      if (idx !== undefined && longDesc) {
        codes[idx].description += ' ' + longDesc;
      }
    }
  }

  console.log(`  Parsed ${codes.length} HCPCS Level II codes`);
  return codes;
}

async function importCollection(db, name, data) {
  if (data.length === 0) {
    console.log(`  Skipping ${name} (no data)`);
    return 0;
  }

  console.log(`\nImporting ${data.length.toLocaleString()} ${name}...`);
  const col = db.collection(name);

  // Insert in batches of 5000
  for (let i = 0; i < data.length; i += 5000) {
    const batch = data.slice(i, i + 5000);
    await col.insertMany(batch);
    const count = Math.min(i + 5000, data.length);
    if (count % 10000 === 0 || count === data.length) {
      console.log(`  Inserted ${count.toLocaleString()}/${data.length.toLocaleString()}`);
    }
  }

  // Create indexes
  await col.createIndex({ code: 1 }, { unique: true });
  await col.createIndex({ category: 1 });
  await col.createIndex({ description: 'text' });
  if (name === 'cpt_codes') {
    await col.createIndex({ totalRVU: -1 });
  }
  console.log(`  Created indexes on ${name}`);

  return await col.countDocuments();
}

async function main() {
  // Check files
  const files = [
    { path: ICD10_FILE, name: 'ICD-10-CM', source: 'https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2026/' },
    { path: CPT_RVU_FILE, name: 'CPT/RVU', source: 'https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files/rvu26a' },
    { path: HCPCS_FILE, name: 'HCPCS', source: 'https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update' }
  ];

  for (const f of files) {
    if (!fs.existsSync(f.path)) {
      console.error(`${f.name} file not found: ${f.path}`);
      console.error(`Download from: ${f.source}`);
      process.exit(1);
    }
  }

  // Parse all files
  const icd10Codes = parseICD10File(ICD10_FILE);
  const cptCodes = parseCPTFile(CPT_RVU_FILE);
  const hcpcsCodes = parseHCPCSFile(HCPCS_FILE);

  // Connect to MongoDB
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('\nConnected to MongoDB');

    const db = client.db(DB_NAME);

    // Drop existing collections
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);
    for (const name of ['icd10_codes', 'cpt_codes', 'hcpcs_codes']) {
      if (colNames.includes(name)) await db.collection(name).drop();
    }

    // Import all collections
    const icd10Count = await importCollection(db, 'icd10_codes', icd10Codes);
    const cptCount = await importCollection(db, 'cpt_codes', cptCodes);
    const hcpcsCount = await importCollection(db, 'hcpcs_codes', hcpcsCodes);

    // Summary
    console.log('\n========================================');
    console.log('IMPORT COMPLETE');
    console.log('========================================');
    console.log(`Database: ${DB_NAME}`);
    console.log(`ICD-10-CM codes:    ${icd10Count.toLocaleString()}`);
    console.log(`CPT codes:          ${cptCount.toLocaleString()}`);
    console.log(`HCPCS Level II:     ${hcpcsCount.toLocaleString()}`);
    console.log(`Total:              ${(icd10Count + cptCount + hcpcsCount).toLocaleString()}`);
    console.log('========================================');

    // ICD-10 category breakdown
    console.log('\nICD-10-CM by category:');
    const icd10Cats = await db.collection('icd10_codes').aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    icd10Cats.forEach(c => console.log(`  ${c._id}: ${c.count.toLocaleString()}`));

    // CPT category breakdown
    console.log('\nCPT by category:');
    const cptCats = await db.collection('cpt_codes').aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    cptCats.forEach(c => console.log(`  ${c._id}: ${c.count.toLocaleString()}`));

  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
