#!/usr/bin/env node
/**
 * Script to create icon files for all 885 medical collections
 * Uses medically appropriate Unicode symbols and emojis
 */

const fs = require('fs');
const path = require('path');

// Professional Medical Icon Mappings
// Using Unicode medical symbols and body part emojis
const MEDICAL_ICONS = {
  // ========== CORE MEDICAL SYMBOLS ==========
  'medical': '⚕',
  'medicine': '⚕',
  'healthcare': '⚕',
  'hospital': '🏥',
  'clinic': '🏥',
  'emergency': '🚑',
  'ambulance': '🚑',
  'trauma': '🚑',
  'critical_care': '🚨',
  'icu': '🚨',
  'intensive_care': '🚨',

  // ========== MEDICATIONS & PHARMACY ==========
  'medication': '💊',
  'prescription': '💊',
  'drug': '💊',
  'pill': '💊',
  'pharmacy': '💊',
  'antibiotic': '💊',
  'antiviral': '💊',
  'chemotherapy': '💊',
  'vaccine': '💉',
  'immunization': '💉',
  'injection': '💉',
  'syringe': '💉',
  'infusion': '💉',
  'iv': '💉',

  // ========== MEDICAL EQUIPMENT & DEVICES ==========
  'stethoscope': '🩺',
  'examination': '🩺',
  'physical': '🩺',
  'thermometer': '🌡',
  'temperature': '🌡',
  'fever': '🌡',
  'bandage': '🩹',
  'dressing': '🩹',
  'wound': '🩹',
  'wheelchair': '♿',
  'mobility': '♿',
  'crutch': '🩼',
  'walking_aid': '🩼',
  'assistive': '🩼',
  'device': '📟',
  'monitor': '📟',
  'pump': '📟',
  'implant': '📟',
  'pacemaker': '📟',

  // ========== LAB & DIAGNOSTICS ==========
  'lab': '🔬',
  'laboratory': '🔬',
  'test': '🔬',
  'specimen': '🔬',
  'microscope': '🔬',
  'pathology': '🔬',
  'blood': '🩸',
  'hematology': '🩸',
  'bleeding': '🩸',
  'hemorrhage': '🩸',
  'culture': '🦠',
  'pathogen': '🦠',
  'virus': '🦠',
  'bacteria': '🦠',
  'infection': '🦠',
  'sepsis': '🦠',
  'microbiology': '🦠',
  'dna': '🧬',
  'genetic': '🧬',
  'gene': '🧬',
  'genomic': '🧬',
  'molecular': '🧬',
  'chromosome': '🧬',

  // ========== IMAGING & RADIOLOGY ==========
  'imaging': '📷',
  'radiology': '📷',
  'xray': '📷',
  'scan': '📷',
  'mri': '📷',
  'ct': '📷',
  'ultrasound': '📷',
  'mammogram': '📷',
  'fluoroscopy': '📷',

  // ========== CARDIOVASCULAR SYSTEM ==========
  'heart': '🫀',
  'cardiac': '🫀',
  'cardio': '🫀',
  'myocardial': '🫀',
  'coronary': '🫀',
  'cardiovascular': '🫀',
  'vascular': '🫀',
  'artery': '🫀',
  'vein': '🫀',
  'blood_pressure': '🫀',
  'hypertension': '🫀',
  'pulse': '🫀',
  'rhythm': '🫀',
  'ecg': '🫀',
  'ekg': '🫀',
  'echocardiogram': '🫀',
  'angiography': '🫀',

  // ========== RESPIRATORY SYSTEM ==========
  'lung': '🫁',
  'pulmonary': '🫁',
  'respiratory': '🫁',
  'breathing': '🫁',
  'asthma': '🫁',
  'copd': '🫁',
  'pneumonia': '🫁',
  'bronchial': '🫁',
  'oxygen': '🫁',
  'ventilator': '🫁',
  'spirometry': '🫁',

  // ========== NEUROLOGICAL SYSTEM ==========
  'brain': '🧠',
  'neuro': '🧠',
  'neurological': '🧠',
  'cognitive': '🧠',
  'memory': '🧠',
  'dementia': '🧠',
  'alzheimer': '🧠',
  'stroke': '🧠',
  'seizure': '🧠',
  'epilepsy': '🧠',
  'headache': '🧠',
  'migraine': '🧠',
  'concussion': '🧠',

  // ========== MUSCULOSKELETAL SYSTEM ==========
  'bone': '🦴',
  'skeletal': '🦴',
  'fracture': '🦴',
  'orthopedic': '🦴',
  'ortho': '🦴',
  'joint': '🦴',
  'spine': '🦴',
  'vertebrae': '🦴',
  'osteoporosis': '🦴',
  'arthritis': '🦴',
  'muscle': '💪',
  'muscular': '💪',
  'strength': '💪',
  'myopathy': '💪',
  'tendon': '💪',
  'ligament': '💪',

  // ========== SENSORY ORGANS ==========
  'eye': '👁',
  'vision': '👁',
  'ophthalm': '👁',
  'visual': '👁',
  'retina': '👁',
  'glaucoma': '👁',
  'cataract': '👁',
  'ear': '👂',
  'hearing': '👂',
  'audiology': '👂',
  'tinnitus': '👂',
  'dental': '🦷',
  'tooth': '🦷',
  'oral': '🦷',
  'periodontal': '🦷',
  'cavity': '🦷',

  // ========== DIGESTIVE SYSTEM ==========
  'stomach': '🫃',
  'gastro': '🫃',
  'digestive': '🫃',
  'intestinal': '🫃',
  'bowel': '🫃',
  'colon': '🫃',
  'liver': '🫃',
  'hepatic': '🫃',
  'pancreas': '🫃',
  'gallbladder': '🫃',
  'esophageal': '🫃',

  // ========== VITAL SIGNS & MONITORING ==========
  'vital': '⚕',
  'signs': '⚕',
  'weight': '⚖',
  'bmi': '⚖',
  'obesity': '⚖',
  'glucose': '🩸',
  'diabetes': '🩸',
  'diabetic': '🩸',
  'sugar': '🩸',
  'a1c': '🩸',
  'insulin': '🩸',

  // ========== PREGNANCY & OBSTETRICS ==========
  'pregnancy': '🤰',
  'pregnant': '🤰',
  'obstetric': '🤰',
  'prenatal': '🤰',
  'antenatal': '🤰',
  'fetal': '🤰',
  'maternal': '🤰',
  'labor': '🤰',
  'delivery': '🤰',
  'postpartum': '🤰',
  'cesarean': '🤰',

  // ========== PEDIATRICS & NEONATOLOGY ==========
  'pediatric': '👶',
  'child': '👶',
  'infant': '👶',
  'newborn': '👶',
  'baby': '👶',
  'neonatal': '👶',
  'birth': '👶',
  'apgar': '👶',

  // ========== CANCER & ONCOLOGY ==========
  'cancer': '🎗',
  'oncology': '🎗',
  'tumor': '🎗',
  'neoplasm': '🎗',
  'malignancy': '🎗',
  'carcinoma': '🎗',
  'lymphoma': '🎗',
  'leukemia': '🎗',
  'metastasis': '🎗',
  'radiation': '☢',
  'radiotherapy': '☢',

  // ========== MENTAL HEALTH & PSYCHIATRY ==========
  'psychiatric': '🧘',
  'psychology': '🧘',
  'mental': '🧘',
  'behavioral': '🧘',
  'depression': '🧘',
  'anxiety': '🧘',
  'therapy': '🧘',
  'counseling': '🧘',
  'psychotherapy': '🧘',

  // ========== PAIN MANAGEMENT ==========
  'pain': '😣',
  'chronic_pain': '😣',
  'acute_pain': '😣',
  'analgesia': '😣',
  'symptom': '😣',
  'complaint': '😣',
  'discomfort': '😣',

  // ========== SLEEP MEDICINE ==========
  'sleep': '😴',
  'insomnia': '😴',
  'apnea': '😴',
  'fatigue': '😴',
  'rest': '😴',

  // ========== ALLERGIES & IMMUNOLOGY ==========
  'allergy': '⚠',
  'allergic': '⚠',
  'reaction': '⚠',
  'adverse': '⚠',
  'anaphylaxis': '⚠',
  'hypersensitivity': '⚠',
  'immunology': '⚠',

  // ========== PROCEDURES & SURGERY ==========
  'surgery': '⚕',
  'surgical': '⚕',
  'operation': '⚕',
  'procedure': '⚕',
  'intervention': '⚕',
  'biopsy': '⚕',
  'catheter': '⚕',
  'endoscopy': '⚕',
  'laparoscopy': '⚕',

  // ========== DIAGNOSIS & ASSESSMENT ==========
  'diagnosis': '📋',
  'assessment': '📋',
  'evaluation': '📋',
  'screening': '📋',
  'differential': '📋',
  'workup': '📋',
  'exam': '🩺',

  // ========== SOCIAL & LIFESTYLE ==========
  'social': '👥',
  'family': '👥',
  'caregiver': '👥',
  'support': '👥',
  'diet': '🥗',
  'nutrition': '🥗',
  'food': '🥗',
  'exercise': '🏃',
  'activity': '🏃',
  'fitness': '🏃',
  'rehabilitation': '🏃',
  'smoking': '🚬',
  'tobacco': '🚬',
  'alcohol': '🍺',
  'substance': '🍺',

  // ========== DOCUMENTATION ==========
  'record': '📄',
  'document': '📄',
  'report': '📄',
  'note': '📝',
  'summary': '📝',
  'comment': '📝',
  'narrative': '📝',
  'history': '📝',

  // ========== ADMINISTRATIVE ==========
  'appointment': '📅',
  'schedule': '📅',
  'followup': '📅',
  'follow_up': '📅',
  'billing': '💰',
  'insurance': '💰',
  'payment': '💰',
  'cost': '💰',
  'administrative': '📋',
  'admission': '📋',
  'discharge': '📋',

  // ========== AI & ANALYTICS ==========
  'ai': '🤖',
  'intelligent': '🤖',
  'automated': '🤖',
  'clinical_decision': '🎯',
  'decision': '🎯',
  'analysis': '📈',
  'trend': '📈',
  'trending': '📈',
  'analytics': '📈',
  'recommend': '💡',
  'suggestion': '💡',
  'insight': '💡',
  'quality': '📊',
  'metric': '📊',
  'measure': '📊',
  'outcome': '📊',
  'education': '📚',
  'teaching': '📚',
  'learning': '📚',
  'guide': '📚',

  // ========== CARE COORDINATION ==========
  'care': '⚕',
  'plan': '📋',
  'goal': '🎯',
  'target': '🎯',
  'coordination': '🔄',
  'referral': '➡',
  'transfer': '➡',
  'transition': '🔄',

  // ========== DERMATOLOGY ==========
  'skin': '🧴',
  'dermatology': '🧴',
  'rash': '🧴',
  'lesion': '🧴',

  // ========== ENDOCRINOLOGY ==========
  'endocrine': '⚗',
  'thyroid': '⚗',
  'hormone': '⚗',
  'metabolic': '⚗',

  // ========== RENAL & UROLOGY ==========
  'kidney': '🫘',
  'renal': '🫘',
  'urology': '🫘',
  'bladder': '🫘',
  'dialysis': '🫘',

  // ========== HEMATOLOGY ==========
  'anemia': '🩸',
  'coagulation': '🩸',
  'clotting': '🩸',
  'transfusion': '🩸',

  // ========== INFECTIOUS DISEASE ==========
  'infectious': '🦠',
  'contagious': '🦠',
  'epidemic': '🦠',
  'pandemic': '🦠',

  // ========== RHEUMATOLOGY ==========
  'rheumatology': '🦴',
  'autoimmune': '⚠',
  'inflammatory': '⚠',

  // ========== GERIATRICS ==========
  'geriatric': '👴',
  'elderly': '👴',
  'aging': '👴',

  // ========== SPORTS MEDICINE ==========
  'sports': '🏃',
  'athlete': '🏃',
  'performance': '🏃',

  // ========== PALLIATIVE & HOSPICE ==========
  'palliative': '🕊',
  'hospice': '🕊',
  'end_of_life': '🕊',
  'comfort': '🕊'
};

function getIconForCategory(categoryName) {
  const name = categoryName.toLowerCase();

  // Try exact match first
  if (MEDICAL_ICONS[name]) {
    return MEDICAL_ICONS[name];
  }

  // Try removing trailing 's' for plurals
  if (name.endsWith('ies')) {
    // allergies -> allergy
    const singular = name.slice(0, -3) + 'y';
    if (MEDICAL_ICONS[singular]) {
      return MEDICAL_ICONS[singular];
    }
  } else if (name.endsWith('s')) {
    const singular = name.slice(0, -1);
    if (MEDICAL_ICONS[singular]) {
      return MEDICAL_ICONS[singular];
    }
  }

  // Split by underscore and try matching each part
  const parts = name.split('_');

  // Priority order: medical specialties/systems first, then generic terms
  const priorityTerms = [
    'cardio', 'cardiac', 'heart', 'neuro', 'brain', 'pulmonary', 'lung', 'respiratory',
    'ortho', 'bone', 'muscle', 'gastro', 'liver', 'renal', 'kidney', 'vascular',
    'ophthalm', 'eye', 'ear', 'dental', 'skin', 'derma', 'oncology', 'cancer',
    'psychiatric', 'mental', 'diabetes', 'endocrine', 'blood', 'hematology',
    'infection', 'virus', 'bacteria', 'genetic', 'dna', 'allergy'
  ];

  // Check priority terms first
  for (const term of priorityTerms) {
    if (name.includes(term) && MEDICAL_ICONS[term]) {
      return MEDICAL_ICONS[term];
    }
  }

  // Try partial matches (start of category name first)
  for (const part of parts) {
    if (MEDICAL_ICONS[part]) {
      return MEDICAL_ICONS[part];
    }
  }

  // Try partial matches (longest match first for better accuracy)
  const matches = [];
  for (const [key, icon] of Object.entries(MEDICAL_ICONS)) {
    if (name.includes(key)) {
      matches.push({ key, icon, length: key.length });
    }
  }

  // Sort by length (longest first) to get most specific match
  matches.sort((a, b) => b.length - a.length);

  if (matches.length > 0) {
    return matches[0].icon;
  }

  // Default icon
  return '📄';
}

// Get all grid files
const gridsDir = path.join(__dirname, 'grids');
const iconsDir = path.join(__dirname, 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const gridFiles = fs.readdirSync(gridsDir).filter(f => f.endsWith('.js'));

console.log(`Creating icon files for ${gridFiles.length} collections...`);

let created = 0;
let skipped = 0;

gridFiles.forEach(file => {
  const collectionName = file.replace('.js', '');
  const iconFile = path.join(iconsDir, file);

  // Skip if icon file already exists
  if (fs.existsSync(iconFile)) {
    skipped++;
    return;
  }

  const icon = getIconForCategory(collectionName);
  const content = `module.exports = {\n  icon: '${icon}'\n};\n`;

  fs.writeFileSync(iconFile, content);
  created++;
});

console.log(`✅ Created ${created} new icon files`);
console.log(`⏭️  Skipped ${skipped} existing files`);
console.log(`📊 Total: ${gridFiles.length} collections`);
