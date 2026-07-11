// Comprehensive list of major medical specialties and common document types
const allMedicalSpecialties = [
  // Primary Care & General
  { specialty: "Family Medicine", covered: true },
  { specialty: "Internal Medicine", covered: true },
  { specialty: "Pediatrics", covered: true },
  { specialty: "Geriatrics", covered: true },
  { specialty: "Preventive Medicine", covered: true },
  { specialty: "Emergency Medicine", covered: true },
  { specialty: "Hospital Medicine/Discharge", covered: true },

  // Medical Specialties
  { specialty: "Cardiology", covered: true },
  { specialty: "Pulmonology", covered: true },
  { specialty: "Gastroenterology", covered: true },
  { specialty: "Nephrology", covered: true },
  { specialty: "Endocrinology", covered: true },
  { specialty: "Rheumatology", covered: true },
  { specialty: "Hematology", covered: true },
  { specialty: "Oncology", covered: true },
  { specialty: "Infectious Disease", covered: true },
  { specialty: "Neurology", covered: true },
  { specialty: "Allergy/Immunology", covered: true },

  // Surgical Specialties
  { specialty: "General Surgery/Operative Reports", covered: true },
  { specialty: "Orthopedic Surgery", covered: true },
  { specialty: "Neurosurgery", covered: true },
  { specialty: "Thoracic Surgery", covered: true },
  { specialty: "Colorectal Surgery", covered: true },
  { specialty: "Plastic Surgery", covered: true },
  { specialty: "Urology", covered: true },
  { specialty: "ENT (Otolaryngology)", covered: true },
  { specialty: "Ophthalmology", covered: true },

  // Women's Health
  { specialty: "Obstetrics", covered: true },
  { specialty: "Maternal-Fetal Medicine", covered: true },
  { specialty: "Gynecology", covered: false }, // MISSING - regular gyn exam

  // Mental Health
  { specialty: "Psychiatry", covered: true },
  { specialty: "Psychology/Neuropsychology", covered: true },

  // Diagnostics & Procedures
  { specialty: "Radiology", covered: true },
  { specialty: "Nuclear Medicine", covered: true },
  { specialty: "Pathology", covered: true },
  { specialty: "Anesthesiology", covered: true },

  // Rehabilitation & Specialty
  { specialty: "Physical Medicine & Rehabilitation (PM&R)", covered: true },
  { specialty: "Sports Medicine", covered: true },
  { specialty: "Medical Genetics", covered: true },

  // Common Subspecialties MISSING
  { specialty: "Sleep Medicine", covered: false }, // MISSING
  { specialty: "Pain Management", covered: false }, // MISSING
  { specialty: "Wound Care/Hyperbaric", covered: false }, // MISSING
  { specialty: "Palliative Care/Hospice", covered: false }, // MISSING
  { specialty: "Occupational Medicine", covered: false }, // MISSING
  { specialty: "Addiction Medicine", covered: false }, // MISSING
  { specialty: "Bariatric Medicine/Surgery", covered: false }, // MISSING
  { specialty: "Vascular Surgery", covered: false }, // MISSING
  { specialty: "Cardiothoracic Surgery (separate from thoracic)", covered: false }, // MISSING
  { specialty: "Hand Surgery", covered: false }, // MISSING
  { specialty: "Podiatry", covered: false }, // MISSING
  { specialty: "Oral/Maxillofacial Surgery", covered: false }, // MISSING
  { specialty: "Transplant Surgery", covered: false }, // MISSING
  { specialty: "Burn Surgery", covered: false }, // MISSING
  { specialty: "Trauma Surgery", covered: false }, // MISSING
  { specialty: "Critical Care/ICU", covered: false }, // MISSING
  { specialty: "Interventional Radiology", covered: false }, // MISSING
  { specialty: "Interventional Cardiology (cath lab)", covered: true }, // cardiac cath STEMI
];

console.log("=".repeat(80));
console.log("MEDICAL SPECIALTY COVERAGE ANALYSIS");
console.log("=".repeat(80));

const covered = allMedicalSpecialties.filter(s => s.covered);
const missing = allMedicalSpecialties.filter(s => !s.covered);

console.log(`\n✅ COVERED: ${covered.length}/${allMedicalSpecialties.length} specialties\n`);
covered.forEach(s => console.log(`  ✅ ${s.specialty}`));

console.log(`\n\n❌ MISSING: ${missing.length}/${allMedicalSpecialties.length} specialties\n`);
missing.forEach((s, idx) => console.log(`  ${idx + 1}. ${s.specialty}`));

console.log("\n" + "=".repeat(80));
console.log("RECOMMENDATIONS FOR NEXT DOCUMENTS:");
console.log("=".repeat(80));

const highPriority = [
  "Sleep Medicine - Common (sleep apnea affects 22M Americans)",
  "Pain Management - Very common (chronic pain ~50M Americans)",
  "Gynecology - Essential women's health coverage",
  "Palliative Care - Important for oncology/geriatric patients",
  "Critical Care/ICU - Common in hospital settings",
  "Interventional Radiology - Common procedures (biopsies, drains)"
];

console.log("\nHIGH PRIORITY (common, lots of data for AI analysis):\n");
highPriority.forEach((rec, idx) => console.log(`  ${idx + 1}. ${rec}`));

const mediumPriority = [
  "Addiction Medicine - Growing field, structured assessments",
  "Bariatric Surgery - Pre-op evaluations, nutritional data",
  "Vascular Surgery - Peripheral artery disease, common in elderly",
  "Wound Care - Diabetic ulcers, pressure injuries",
  "Occupational Medicine - Work injuries, disability evaluations"
];

console.log("\nMEDIUM PRIORITY (moderate frequency):\n");
mediumPriority.forEach((rec, idx) => console.log(`  ${idx + 1}. ${rec}`));

console.log("\n" + "=".repeat(80));
console.log(`\nCoverage: ${Math.round((covered.length / allMedicalSpecialties.length) * 100)}%`);
console.log(`Still needed: ${missing.length} specialties\n`);
