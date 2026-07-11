const fs = require('fs');

// Read both CSV files
const patinetsCsv = fs.readFileSync('/home/erangross/Documents/patinets.csv', 'utf-8');
const updatedCsv = fs.readFileSync('/home/erangross/Documents/updated_patients.csv', 'utf-8');

// Parse patinets.csv (tab-separated, no header)
const patinetsLines = patinetsCsv.split('\n').filter(line => line.trim());
const patinetsNames = new Set();

patinetsLines.forEach(line => {
  const parts = line.split('\t');
  if (parts.length >= 2) {
    const firstName = parts[0].trim();
    const lastName = parts[1].trim();
    patinetsNames.add(`${firstName} ${lastName}`);
  }
});

console.log(`Patients in patinets.csv: ${patinetsNames.size}`);

// Parse updated_patients.csv (comma-separated, has header)
const updatedLines = updatedCsv.split('\n').filter(line => line.trim());
const updatedNames = [];

for (let i = 1; i < updatedLines.length; i++) { // Skip header
  const parts = updatedLines[i].split(',');
  if (parts.length >= 2) {
    const firstName = parts[0].trim();
    const lastName = parts[1].trim();
    updatedNames.push(`${firstName} ${lastName}`);
  }
}

console.log(`Patients in updated_patients.csv: ${updatedNames.length}`);

// Find missing patient
console.log('\n========================================');
console.log('MISSING PATIENT (in updated_patients.csv but NOT in patinets.csv):');
console.log('========================================\n');

const missing = [];
updatedNames.forEach(name => {
  if (!patinetsNames.has(name)) {
    missing.push(name);
  }
});

if (missing.length === 0) {
  console.log('✅ No missing patients - all are in both files');
} else {
  missing.forEach((name, idx) => {
    console.log(`${idx + 1}. ${name}`);
  });
}

console.log(`\nTotal missing: ${missing.length}`);
