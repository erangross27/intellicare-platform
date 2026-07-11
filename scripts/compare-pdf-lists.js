const fs = require('fs');

// Read existing 49 patients CSV
const existingCSV = fs.readFileSync('/home/erangross/Documents/patinets.csv', 'utf-8');
const existingLines = existingCSV.split('\n').filter(line => line.trim());

// Read new 23 patients CSV
const newCSV = fs.readFileSync('/home/erangross/Documents/new_23_patients.csv', 'utf-8');
const newLines = newCSV.split('\n').filter(line => line.trim());

// Extract existing PDF subjects
const existingSubjects = new Set();
for (let i = 1; i < existingLines.length; i++) {
  const parts = existingLines[i].split('\t');
  if (parts.length >= 7) {
    const pdfFilename = parts[6].trim();
    if (pdfFilename) {
      // Normalize: remove .pdf, lowercase, remove underscores/spaces
      const normalized = pdfFilename
        .replace(/\.pdf$/i, '')
        .toLowerCase()
        .replace(/[_\s-]/g, '')
        .replace(/[^\w]/g, '');
      existingSubjects.add(normalized);
    }
  }
}

console.log('========================================');
console.log('DUPLICATE DETECTION');
console.log('========================================\n');

const duplicates = [];
const trulyNew = [];

// Check each new PDF
for (let i = 1; i < newLines.length; i++) {
  const parts = newLines[i].split(',');
  if (parts.length >= 7) {
    const firstName = parts[0].trim();
    const lastName = parts[1].trim();
    const pdfFilename = parts[6].trim();

    // Normalize new PDF filename
    const normalized = pdfFilename
      .replace(/\.pdf$/i, '')
      .toLowerCase()
      .replace(/[_\s-]/g, '')
      .replace(/[^\w]/g, '');

    if (existingSubjects.has(normalized)) {
      duplicates.push({ name: `${firstName} ${lastName}`, pdf: pdfFilename });
    } else {
      trulyNew.push({ name: `${firstName} ${lastName}`, pdf: pdfFilename });
    }
  }
}

console.log(`❌ DUPLICATES (${duplicates.length}):`);
if (duplicates.length > 0) {
  duplicates.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.name} → ${item.pdf}`);
  });
} else {
  console.log('  None found!');
}

console.log(`\n✅ TRULY NEW (${trulyNew.length}):`);
trulyNew.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.name} → ${item.pdf}`);
});

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Existing PDFs: ${existingSubjects.size}`);
console.log(`New PDFs requested: ${newLines.length - 1}`);
console.log(`Duplicates found: ${duplicates.length}`);
console.log(`Truly new PDFs: ${trulyNew.length}`);
console.log('========================================\n');
