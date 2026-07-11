const fs = require('fs');

// Read CSV to get all PDF filenames
const csvContent = fs.readFileSync('/home/erangross/Documents/patinets.csv', 'utf-8');
const csvLines = csvContent.split('\n').filter(line => line.trim());

const pdfFiles = csvLines.map(line => {
  const parts = line.split(',');
  return parts[6] ? parts[6].trim() : '';
}).filter(pdf => pdf);

console.log(`Total PDF files: ${pdfFiles.length}\n`);

// Categorize by medical specialty/condition
const categories = {
  'Cardiology - General': [],
  'Cardiology - ACS/STEMI': [],
  'Cardiology - AFib/Anticoagulation': [],
  'Cardiology - Heart Failure': [],
  'Cardiology - Procedures': [],
  'Pulmonology - Asthma': [],
  'Pulmonology - General': [],
  'Neurosurgery': [],
  'Endocrinology': [],
  'Emergency Medicine': [],
  'Pediatrics': [],
  'Psychiatry': [],
  'Oncology': [],
  'Gastroenterology': [],
  'Nephrology': [],
  'Obstetrics': [],
  'Gynecology': [],
  'Surgery - General': [],
  'Surgery - Orthopedic': [],
  'Surgery - Colorectal': [],
  'Surgery - Plastic': [],
  'Surgery - Thoracic': [],
  'Neurology': [],
  'Rheumatology': [],
  'Hematology': [],
  'Infectious Disease': [],
  'Urology': [],
  'Ophthalmology': [],
  'Dermatology': [],
  'ENT': [],
  'Allergy/Immunology': [],
  'Anesthesiology': [],
  'Pathology': [],
  'Radiology': [],
  'Nuclear Medicine': [],
  'Physical Medicine & Rehab': [],
  'Preventive Medicine': [],
  'Family Medicine': [],
  'Internal Medicine': [],
  'Geriatrics': [],
  'Sports Medicine': [],
  'Sleep Medicine': [],
  'Pain Management': [],
  'Palliative Care': [],
  'Medical Genetics': [],
  'Maternal-Fetal Medicine': [],
  'Other': []
};

// Categorize each PDF
pdfFiles.forEach(pdf => {
  const lower = pdf.toLowerCase();

  // Cardiology subcategories
  if (lower.includes('cardiology') && (lower.includes('acs') || lower.includes('acute coronary') || lower.includes('stemi'))) {
    categories['Cardiology - ACS/STEMI'].push(pdf);
  } else if (lower.includes('cardiac_catheterization') || lower.includes('stemi_acs') || lower.includes('cardiac_biomarker') || lower.includes('quality_metrics_door')) {
    categories['Cardiology - ACS/STEMI'].push(pdf);
  } else if (lower.includes('anticoagulation') || lower.includes('afib') || lower.includes('implantable_cardiac')) {
    categories['Cardiology - AFib/Anticoagulation'].push(pdf);
  } else if (lower.includes('cardiac_rehabilitation')) {
    categories['Cardiology - Heart Failure'].push(pdf);
  } else if (lower.includes('cardiology')) {
    categories['Cardiology - General'].push(pdf);
  }
  // Pulmonology
  else if (lower.includes('pulmonology_asthma') || lower.includes('asthma')) {
    categories['Pulmonology - Asthma'].push(pdf);
  } else if (lower.includes('pulmonology') || lower.includes('pulmonary_function')) {
    categories['Pulmonology - General'].push(pdf);
  }
  // Neurosurgery
  else if (lower.includes('neurosurgery') || lower.includes('brain_tumor') || lower.includes('awake_craniotomy') || lower.includes('fmri_dti')) {
    categories['Neurosurgery'].push(pdf);
  }
  // Emergency
  else if (lower.includes('emergency')) {
    categories['Emergency Medicine'].push(pdf);
  }
  // Pediatrics
  else if (lower.includes('pediatric')) {
    categories['Pediatrics'].push(pdf);
  }
  // Psychiatry
  else if (lower.includes('psychiatric') || lower.includes('neuropsychological')) {
    categories['Psychiatry'].push(pdf);
  }
  // Oncology
  else if (lower.includes('oncology') || lower.includes('clinical_trial')) {
    categories['Oncology'].push(pdf);
  }
  // Other specialties (single assignment)
  else if (lower.includes('endocrinology')) categories['Endocrinology'].push(pdf);
  else if (lower.includes('gastroenterology')) categories['Gastroenterology'].push(pdf);
  else if (lower.includes('nephrology')) categories['Nephrology'].push(pdf);
  else if (lower.includes('obstetric')) categories['Obstetrics'].push(pdf);
  else if (lower.includes('gynecology')) categories['Gynecology'].push(pdf);
  else if (lower.includes('operative_report') || lower.includes('operative report')) categories['Surgery - General'].push(pdf);
  else if (lower.includes('orthopedic')) categories['Surgery - Orthopedic'].push(pdf);
  else if (lower.includes('colorectal')) categories['Surgery - Colorectal'].push(pdf);
  else if (lower.includes('plastic')) categories['Surgery - Plastic'].push(pdf);
  else if (lower.includes('thoracic')) categories['Surgery - Thoracic'].push(pdf);
  else if (lower.includes('neurology')) categories['Neurology'].push(pdf);
  else if (lower.includes('rheumatology')) categories['Rheumatology'].push(pdf);
  else if (lower.includes('hematology')) categories['Hematology'].push(pdf);
  else if (lower.includes('infectious')) categories['Infectious Disease'].push(pdf);
  else if (lower.includes('urology')) categories['Urology'].push(pdf);
  else if (lower.includes('ophthalmology')) categories['Ophthalmology'].push(pdf);
  else if (lower.includes('dermatology')) categories['Dermatology'].push(pdf);
  else if (lower.includes('ent')) categories['ENT'].push(pdf);
  else if (lower.includes('allergy')) categories['Allergy/Immunology'].push(pdf);
  else if (lower.includes('anesthesiology')) categories['Anesthesiology'].push(pdf);
  else if (lower.includes('pathology')) categories['Pathology'].push(pdf);
  else if (lower.includes('radiology')) categories['Radiology'].push(pdf);
  else if (lower.includes('nuclear_medicine')) categories['Nuclear Medicine'].push(pdf);
  else if (lower.includes('pmr_evaluation')) categories['Physical Medicine & Rehab'].push(pdf);
  else if (lower.includes('preventive_medicine')) categories['Preventive Medicine'].push(pdf);
  else if (lower.includes('family_medicine')) categories['Family Medicine'].push(pdf);
  else if (lower.includes('internal_medicine')) categories['Internal Medicine'].push(pdf);
  else if (lower.includes('geriatric')) categories['Geriatrics'].push(pdf);
  else if (lower.includes('sports_physical')) categories['Sports Medicine'].push(pdf);
  else if (lower.includes('sleep_medicine')) categories['Sleep Medicine'].push(pdf);
  else if (lower.includes('pain_management')) categories['Pain Management'].push(pdf);
  else if (lower.includes('palliative')) categories['Palliative Care'].push(pdf);
  else if (lower.includes('medical_genetics') || lower.includes('genetic_testing')) categories['Medical Genetics'].push(pdf);
  else if (lower.includes('maternal')) categories['Maternal-Fetal Medicine'].push(pdf);
  // Special topics
  else if (lower.includes('biologic_therapy') || lower.includes('medication_access') || lower.includes('barriers_to_care') ||
           lower.includes('clinical_risk') || lower.includes('environmental_modifications') ||
           lower.includes('functional_status') || lower.includes('discharge_planning')) {
    categories['Other'].push(pdf);
  }
  else {
    categories['Other'].push(pdf);
  }
});

console.log('='.repeat(80));
console.log('MEDICAL SPECIALTY ANALYSIS - DUPLICATE TOPICS CHECK');
console.log('='.repeat(80) + '\n');

let duplicatesFound = false;

Object.keys(categories).forEach(category => {
  const files = categories[category];
  if (files.length > 0) {
    const marker = files.length > 1 ? '⚠️  MULTIPLE' : '✅';
    console.log(`${marker} ${category}: ${files.length} file(s)`);
    files.forEach((file, idx) => {
      console.log(`    ${idx + 1}. ${file}`);
    });
    console.log('');

    if (files.length > 1) {
      duplicatesFound = true;
    }
  }
});

console.log('='.repeat(80));
if (duplicatesFound) {
  console.log('⚠️  DUPLICATES DETECTED: Multiple PDFs cover similar medical conditions');
  console.log('This may provide RICHER data for AI analysis (different presentations of same condition)');
  console.log('OR may be redundant if content is too similar.');
} else {
  console.log('✅ NO DUPLICATES: Each PDF covers a unique medical specialty/condition');
}
console.log('='.repeat(80));
