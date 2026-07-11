const fs = require('fs');

// Current CSV (should be 72 patients)
const currentCsv = fs.readFileSync('/home/erangross/Documents/patinets.csv', 'utf-8');
const currentLines = currentCsv.split('\n').filter(line => line.trim());

console.log(`Current CSV has ${currentLines.length} patients\n`);

// Original 49 from the start of conversation
const original49 = [
  "David Wilson", "Helen Cox", "Richard Phillips", "Michael Chen", "Amanda White",
  "Joseph Lewis", "Andrew Peterson", "Betty Bailey", "Jessica Turner", "Jennifer Miller",
  "Christopher Lee", "Thomas Roberts", "Michelle Hall", "Barbara Mitchell", "Charles Edwards",
  "Matthew Stewart", "Margaret Smith", "William Young", "Robert Henderson", "Nancy Ward",
  "William Johnson", "Paul Howard", "James Taylor", "Anjali Patel", "Emily Wilson",
  "Brian Richardson", "Sandra Williams", "John Smith", "Steven Rivera", "Kenneth Rogers",
  "Lisa Martinez", "Rachel Robinson", "Maria Garcia", "Catherine Evans", "Kevin Walker",
  "George Parker", "Sarah Davis", "Daniel Harris", "Susan Reed", "Linda Morris",
  "Margaret Cooper", "Michael Johnson", "Nicole Clark", "Emily Thompson", "Robert Brown",
  "Patricia Campbell", "Emma Thompson", "Donald Cook", "Dorothy Collins"
];

// Parse current CSV
const currentPatients = currentLines.map(line => {
  const parts = line.split(',');
  return `${parts[0]} ${parts[1]}`;
});

console.log('Checking original 49 patients...\n');
const missing = [];
original49.forEach(name => {
  if (!currentPatients.includes(name)) {
    missing.push(name);
    console.log(`  ❌ MISSING: ${name}`);
  }
});

if (missing.length === 0) {
  console.log('  ✅ All original 49 found!');
}

const chrisLeeIndex = currentPatients.indexOf('Christopher Lee');
console.log(`\n50th patient (Christopher Lee): ${chrisLeeIndex >= 0 ? '✅ Found at line ' + (chrisLeeIndex + 1) : '❌ Missing'}`);
console.log(`\nTotal patients needed: 50 + 22 = 72`);
console.log(`Total patients in CSV: ${currentLines.length}`);
console.log(`Missing count: ${72 - currentLines.length}`);
