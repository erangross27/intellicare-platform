const fs = require('fs');
const path = require('path');

// Read the existing patients CSV
const csvPath = '/home/erangross/Documents/patinets.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV (tab-separated)
const lines = csvContent.split('\n').filter(line => line.trim());
const existingPDFs = [];

for (let i = 1; i < lines.length; i++) { // Skip header
  const parts = lines[i].split('\t');
  if (parts.length >= 7) {
    const pdfFilename = parts[6].trim();
    if (pdfFilename) {
      existingPDFs.push(pdfFilename);
    }
  }
}

console.log('========================================');
console.log('EXISTING PDF MEDICAL SUBJECTS (49 files)');
console.log('========================================\n');

// Extract medical subjects from filenames
const subjects = existingPDFs.map(filename => {
  // Remove .pdf extension
  let subject = filename.replace(/\.pdf$/i, '');

  // Extract specialty/subject
  subject = subject
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capitals
    .replace(/\s+/g, ' ')
    .trim();

  return subject;
}).sort();

subjects.forEach((subject, idx) => {
  console.log(`${idx + 1}. ${subject}`);
});

console.log(`\nTotal: ${subjects.length} unique medical subjects\n`);

// Categorize by specialty
const specialties = {
  'Cardiology': [],
  'Pulmonology': [],
  'Neurology/Neurosurgery': [],
  'GI/Colorectal': [],
  'Endocrinology': [],
  'Hematology/Oncology': [],
  'Emergency Medicine': [],
  'Pediatrics': [],
  'Surgery': [],
  'Psychiatry': [],
  'Other': []
};

subjects.forEach(subject => {
  const lower = subject.toLowerCase();
  if (lower.includes('cardio') || lower.includes('cardiac') || lower.includes('heart')) {
    specialties['Cardiology'].push(subject);
  } else if (lower.includes('pulmon') || lower.includes('asthma') || lower.includes('lung')) {
    specialties['Pulmonology'].push(subject);
  } else if (lower.includes('neuro') || lower.includes('brain')) {
    specialties['Neurology/Neurosurgery'].push(subject);
  } else if (lower.includes('gastro') || lower.includes('colorectal') || lower.includes('bowel')) {
    specialties['GI/Colorectal'].push(subject);
  } else if (lower.includes('endocrin') || lower.includes('diabetes')) {
    specialties['Endocrinology'].push(subject);
  } else if (lower.includes('hematol') || lower.includes('oncolog') || lower.includes('cancer')) {
    specialties['Hematology/Oncology'].push(subject);
  } else if (lower.includes('emergency') || lower.includes('discharge summary')) {
    specialties['Emergency Medicine'].push(subject);
  } else if (lower.includes('pediatric') || lower.includes('child')) {
    specialties['Pediatrics'].push(subject);
  } else if (lower.includes('surgery') || lower.includes('operative')) {
    specialties['Surgery'].push(subject);
  } else if (lower.includes('psychiat')) {
    specialties['Psychiatry'].push(subject);
  } else {
    specialties['Other'].push(subject);
  }
});

console.log('========================================');
console.log('BREAKDOWN BY SPECIALTY');
console.log('========================================\n');

Object.entries(specialties).forEach(([specialty, docs]) => {
  if (docs.length > 0) {
    console.log(`\n${specialty} (${docs.length}):`);
    docs.forEach(doc => console.log(`  - ${doc}`));
  }
});

console.log('\n========================================');
console.log('KEY FINDINGS');
console.log('========================================\n');

console.log('Existing Coverage:');
console.log(`- Cardiology: ${specialties['Cardiology'].length} documents`);
console.log(`- Pulmonology: ${specialties['Pulmonology'].length} documents`);
console.log(`- Neurology/Neurosurgery: ${specialties['Neurology/Neurosurgery'].length} documents`);
console.log(`- Emergency Medicine: ${specialties['Emergency Medicine'].length} documents`);
console.log(`- GI/Colorectal: ${specialties['GI/Colorectal'].length} documents`);
console.log(`- Endocrinology: ${specialties['Endocrinology'].length} documents`);
console.log(`- Hematology/Oncology: ${specialties['Hematology/Oncology'].length} documents`);
console.log(`- Surgery: ${specialties['Surgery'].length} documents`);
console.log(`- Pediatrics: ${specialties['Pediatrics'].length} documents`);
console.log(`- Psychiatry: ${specialties['Psychiatry'].length} documents`);
console.log(`- Other: ${specialties['Other'].length} documents`);
