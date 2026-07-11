const fs = require('fs');

// Existing 72 patients from CSV
const csvContent = fs.readFileSync('/home/erangross/Documents/patinets.csv', 'utf-8');
const csvLines = csvContent.split('\n').filter(line => line.trim());
const existingPatients = csvLines.map(line => {
  const parts = line.split(',');
  return `${parts[0]} ${parts[1]}`;
});

console.log(`Existing patients in CSV: ${existingPatients.length}\n`);

// NEW 17 patients from master list
const newPatients = [
  'Thomas Martinez',
  'Jennifer Rodriguez',
  'Harold Bennett',
  'Maria Gonzalez',
  'Robert Chen',
  'James Patterson',
  'Michael Torres',
  'Angela Wright',
  'George Williams',
  'David Kim',
  'Susan Baker',
  'Kevin Miller',
  'Richard Adams',
  'Laura Martinez',
  'Tyler Johnson',
  'Patricia Davis',
  'Anthony Brown'
];

console.log(`New patients to add: ${newPatients.length}\n`);
console.log('='.repeat(80));
console.log('CHECKING FOR DUPLICATES:');
console.log('='.repeat(80) + '\n');

const duplicates = [];
const unique = [];

newPatients.forEach((newName, idx) => {
  const isDuplicate = existingPatients.some(existingName =>
    existingName.toLowerCase() === newName.toLowerCase()
  );

  if (isDuplicate) {
    duplicates.push(`${idx + 1}. ❌ DUPLICATE: ${newName}`);
  } else {
    unique.push(`${idx + 1}. ✅ UNIQUE: ${newName}`);
  }
});

if (duplicates.length > 0) {
  console.log('DUPLICATES FOUND:\n');
  duplicates.forEach(d => console.log(d));
  console.log('');
}

if (unique.length > 0) {
  console.log('UNIQUE NAMES (Safe to add):\n');
  unique.forEach(u => console.log(u));
  console.log('');
}

console.log('='.repeat(80));
console.log(`SUMMARY:`);
console.log(`  Total new patients: ${newPatients.length}`);
console.log(`  Duplicates: ${duplicates.length}`);
console.log(`  Unique: ${unique.length}`);
console.log('='.repeat(80));

if (duplicates.length > 0) {
  console.log('\n⚠️  WARNING: Need to rename duplicate patients before adding to CSV!');
  console.log('Suggested alternatives for duplicates:\n');

  duplicates.forEach(dup => {
    const name = dup.split('DUPLICATE: ')[1];
    const [first, last] = name.split(' ');
    console.log(`  "${name}" → Change to "${first} ${last[0]}. [DifferentLastName]" or use middle initial`);
  });
}
