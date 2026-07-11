const fs = require('fs');

// Database patients (72 total)
const dbPatients = [
  'James Taylor', 'Emily Wilson', 'Jennifer Miller', 'John Smith', 'Lisa Martinez',
  'Sarah Davis', 'Michael Johnson', 'Robert Brown', 'David Wilson', 'Maria Garcia',
  'Christopher Lee', 'Emma Thompson', 'Daniel Harris', 'Nicole Clark', 'Amanda White',
  'Rachel Robinson', 'Kevin Walker', 'Joseph Lewis', 'Michelle Hall', 'William Young',
  'Emily Thompson', 'Robert Henderson', 'Sandra Williams', 'William Johnson', 'Margaret Smith',
  'Andrew Peterson', 'Thomas Roberts', 'Barbara Mitchell', 'Michael Chen', 'Anjali Patel',
  'Patricia Campbell', 'George Parker', 'Richard Phillips', 'Jessica Turner', 'Catherine Evans',
  'Dorothy Collins', 'Linda Morris', 'Charles Edwards', 'Kenneth Rogers', 'Matthew Stewart',
  'Donald Cook', 'Steven Rivera', 'Susan Reed', 'Betty Bailey', 'Margaret Cooper',
  'Paul Howard', 'Brian Richardson', 'Helen Cox', 'Nancy Ward', 'Sarah Anderson',
  'Tyrone Washington', 'Marcus Johnson', 'Elena Rodriguez', 'Patricia Anderson', 'Derek Thompson',
  'Samantha Lee', 'Vanessa Martinez', 'Gloria Hernandez', 'Raymond Foster', 'Kenneth Davis',
  'Diane Wilson', 'Angela Thomas', 'Jerome Jackson', 'Vincent Moore', 'Brenda Taylor',
  'Terrence Anderson', 'Monica Clark', 'Gregory Lewis', 'Sharon Walker', 'Carlos King',
  'Russell Hall', 'Tiffany Young'
];

// CSV patients (71 total)
const csvContent = fs.readFileSync('/home/erangross/Documents/patinets.csv', 'utf-8');
const csvLines = csvContent.split('\n').filter(line => line.trim());
const csvPatients = csvLines.map(line => {
  const parts = line.split(',');
  return `${parts[0]} ${parts[1]}`;
});

console.log(`Database has ${dbPatients.length} patients`);
console.log(`CSV has ${csvPatients.length} patients`);
console.log(`\nMissing from CSV (in DB but not in CSV):\n`);

const missing = [];
dbPatients.forEach(name => {
  if (!csvPatients.includes(name)) {
    missing.push(name);
    console.log(`  ❌ ${name}`);
  }
});

if (missing.length === 0) {
  console.log('  ✅ No missing patients - all DB patients are in CSV');
}

console.log(`\nTotal missing: ${missing.length}`);
