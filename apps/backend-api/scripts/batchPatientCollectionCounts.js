#!/usr/bin/env node

/**
 * Batch Patient Medical-Collection Counter
 *
 * Reads a list of patient names (one "First Last" per line) from a file and reports
 * how many medical collections contain data for each patient. Flags patients BELOW a
 * threshold (default 5 collections).
 *
 * Usage:
 *   node scripts/batchPatientCollectionCounts.js --file <path> [--min 5]
 *   node scripts/batchPatientCollectionCounts.js --file patientList.txt --min 5
 *
 * Mirrors showPatientMedicalCollections.js (same DB, same name lookup, same count logic).
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const medicalCollectionsService = require('../services/medicalCollectionsService');

const mongoUriPath = path.join(__dirname, '../.kms/MONGODB_ADMIN_URI');
const MONGO_URI = fs.readFileSync(mongoUriPath, 'utf8').trim();
const DB_NAME = 'intellicare_practice_yale';
const SKIP_COLLECTIONS = ['appointments'];

const MEDICAL_COLLECTIONS = medicalCollectionsService.getAllCollections()
  .filter(name => !SKIP_COLLECTIONS.includes(name));

function parseArgs() {
  const args = { min: 5 };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--file' && i + 1 < process.argv.length) { args.file = process.argv[++i]; }
    else if (process.argv[i] === '--min' && i + 1 < process.argv.length) { args.min = parseInt(process.argv[++i], 10); }
  }
  return args;
}

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\'/]/g, '\\$&');

async function findPatientsByName(db, name) {
  // Normalize internal whitespace (the list uses multiple spaces between names)
  const nameParts = name.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  return await db.collection('patients').find({
    firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
    lastName: new RegExp(`^${escapeRegex(lastName)}$`, 'i'),
  }).toArray();
}

async function countCollections(db, patient, medicalCollectionsInDb) {
  let collectionsWithData = 0;
  let totalDocuments = 0;
  for (const collectionName of medicalCollectionsInDb) {
    const count = await db.collection(collectionName).countDocuments({
      $or: [{ patientId: patient._id }, { patientId: patient._id.toString() }],
    });
    if (count > 0) { collectionsWithData++; totalDocuments += count; }
  }
  return { collectionsWithData, totalDocuments };
}

async function main() {
  const args = parseArgs();
  if (!args.file) { console.error('Error: provide --file <path> (one "First Last" per line)'); process.exit(1); }

  const raw = fs.readFileSync(path.resolve(args.file), 'utf8');
  const names = raw.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const allCollectionNames = (await db.listCollections().toArray()).map(c => c.name);
  const medicalCollectionsInDb = MEDICAL_COLLECTIONS.filter(name => allCollectionNames.includes(name));

  console.log(`\n📋 ${names.length} patients | checking ${medicalCollectionsInDb.length} medical collections | threshold < ${args.min}\n`);
  console.log('━'.repeat(70));

  const results = [];
  for (const name of names) {
    const patients = await findPatientsByName(db, name);
    if (patients.length === 0) {
      results.push({ name, status: 'NOT_FOUND', count: null });
    } else if (patients.length > 1) {
      // count each, report ambiguity but use the max so we don't false-flag
      let best = -1, bestDocs = 0, ids = [];
      for (const p of patients) {
        const { collectionsWithData, totalDocuments } = await countCollections(db, p, medicalCollectionsInDb);
        ids.push(`${p._id}(${collectionsWithData})`);
        if (collectionsWithData > best) { best = collectionsWithData; bestDocs = totalDocuments; }
      }
      results.push({ name, status: 'MULTIPLE', count: best, docs: bestDocs, note: ids.join(', ') });
    } else {
      const { collectionsWithData, totalDocuments } = await countCollections(db, patients[0], medicalCollectionsInDb);
      results.push({ name, status: 'OK', count: collectionsWithData, docs: totalDocuments, id: patients[0]._id });
    }
  }

  await client.close();

  const maxName = Math.max(...results.map(r => r.name.length));
  results.forEach(r => {
    const nm = r.name.padEnd(maxName);
    if (r.status === 'NOT_FOUND') { console.log(`  ${nm}  ❓ NOT FOUND`); return; }
    const flag = r.count < args.min ? '⚠️ ' : '   ';
    const cnt = String(r.count).padStart(2);
    const multi = r.status === 'MULTIPLE' ? `  [MULTIPLE: ${r.note}]` : '';
    console.log(`  ${nm}  ${flag}${cnt} collections, ${r.docs} docs${multi}`);
  });

  console.log('━'.repeat(70));
  const below = results.filter(r => r.status !== 'NOT_FOUND' && r.count < args.min);
  const notFound = results.filter(r => r.status === 'NOT_FOUND');
  console.log(`\n⚠️  ${below.length} patient(s) with FEWER than ${args.min} collections:`);
  below.forEach(r => console.log(`   - ${r.name} (${r.count} collections)`));
  if (notFound.length) {
    console.log(`\n❓ ${notFound.length} not found:`);
    notFound.forEach(r => console.log(`   - ${r.name}`));
  }
  console.log('');
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
