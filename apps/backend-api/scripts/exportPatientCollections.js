#!/usr/bin/env node

/**
 * Export CSV: every (patient full name -> medical collection that HAS data) pair.
 *
 * For each registered medical collection, finds the distinct patientIds that have >=1 document,
 * maps them to "First Last", and writes a CSV with the collection name de-underscored + Title Cased
 * (so a row can be pasted straight into a prompt, e.g. "David Wilson Smoking Cessation Program").
 *
 * Usage:  node scripts/exportPatientCollections.js
 * Output: /home/erangross/IntelliCare/patient_collections.csv
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const medicalCollectionsService = require('../services/medicalCollectionsService');

const MONGO_URI = fs.readFileSync(path.join(__dirname, '../.kms/MONGODB_ADMIN_URI'), 'utf8').trim();
const DB_NAME = 'intellicare_practice_yale';
const OUTPUT = '/home/erangross/IntelliCare/patient_collections.csv';
const SKIP_COLLECTIONS = ['appointments'];

const MEDICAL_COLLECTIONS = medicalCollectionsService.getAllCollections()
  .filter(name => !SKIP_COLLECTIONS.includes(name));

// "smoking_cessation_program" -> "Smoking Cessation Program"
const displayName = (snake) => snake
  .split('_')
  .filter(Boolean)
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`Connected. DB=${DB_NAME}, medical collections=${MEDICAL_COLLECTIONS.length}`);

  // 1) patientId(hex) -> "First Last"
  const patients = await db.collection('patients')
    .find({}, { projection: { firstName: 1, lastName: 1 } }).toArray();
  const nameById = new Map();
  for (const p of patients) {
    const full = `${p.firstName || ''} ${p.lastName || ''}`.trim() || '(unknown)';
    nameById.set(String(p._id), full);
  }
  console.log(`Loaded ${patients.length} patients`);

  // 2) Only collections that actually exist in the DB
  const existing = new Set((await db.listCollections().toArray()).map(c => c.name));
  const toScan = MEDICAL_COLLECTIONS.filter(n => existing.has(n));
  console.log(`Scanning ${toScan.length} collections that exist in DB...`);

  // 3) For each collection, distinct patientIds with data -> rows
  const rows = []; // { patient, collection, records }
  let scanned = 0;
  for (const coll of toScan) {
    const agg = await db.collection(coll).aggregate([
      { $match: { patientId: { $exists: true, $ne: null } } },
      { $group: { _id: '$patientId', count: { $sum: 1 } } }
    ]).toArray();
    for (const g of agg) {
      const name = nameById.get(String(g._id));
      if (!name) continue; // patientId with no matching patient record
      rows.push({ patient: name, collection: displayName(coll), records: g.count });
    }
    if (++scanned % 100 === 0) console.log(`  ...${scanned}/${toScan.length}`);
  }

  // 4) Dedupe to ONE patient per collection — pick the patient with the MOST records
  //    (richest example to review); tie -> alphabetical patient name.
  const bestByCollection = new Map(); // collection -> { patient, collection, records }
  for (const r of rows) {
    const cur = bestByCollection.get(r.collection);
    if (!cur || r.records > cur.records || (r.records === cur.records && r.patient.localeCompare(cur.patient) < 0)) {
      bestByCollection.set(r.collection, r);
    }
  }
  const deduped = Array.from(bestByCollection.values())
    .sort((a, b) => a.collection.localeCompare(b.collection)); // one row per collection, A→Z

  // 5) Write CSV (Paste column = ready-to-use "<Name> <Collection>")
  const header = 'Collection,Patient Name,Records,Paste';
  const lines = deduped.map(r =>
    [csvCell(r.collection), csvCell(r.patient), r.records, csvCell(`Show me ${r.patient} ${r.collection}`)].join(',')
  );
  fs.writeFileSync(OUTPUT, header + '\n' + lines.join('\n') + '\n', 'utf8');

  console.log(`\n✅ Wrote ${deduped.length} collections (one patient each) -> ${OUTPUT}`);
  console.log(`   (from ${rows.length} total patient×collection pairs)`);

  await client.close();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
