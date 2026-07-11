/**
 * Seed Billing Codes - CPT and ICD-10 codes into MongoDB
 *
 * Sources (ALL FREE):
 * - CPT codes: From CMS Physician Fee Schedule (public government data)
 * - ICD-10 codes: From CMS/CDC (public domain, no license needed)
 * - HCPCS Level II: From CMS (government-owned codes)
 *
 * Run: node apps/backend-api/scripts/seedBillingCodes.js
 */

const { MongoClient } = require('mongodb');

// MongoDB connection - same as the app uses
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'intellicare_practice_global';
const COLLECTION = 'billing_codes';

// ============================================================
// CPT CODES - From CMS Physician Fee Schedule (Public Data)
// These are the code numbers + CMS short descriptions (not AMA long descriptions)
// ============================================================
const CPT_CODES = [
  // === EVALUATION & MANAGEMENT - Office Visits (New Patient) ===
  { code: '99201', type: 'CPT', category: 'E&M', description: 'Office visit, new patient, minimal', rvu: 0.48, globalPeriod: 'XXX' },
  { code: '99202', type: 'CPT', category: 'E&M', description: 'Office visit, new patient, straightforward', rvu: 0.93, globalPeriod: 'XXX' },
  { code: '99203', type: 'CPT', category: 'E&M', description: 'Office visit, new patient, low complexity', rvu: 1.60, globalPeriod: 'XXX' },
  { code: '99204', type: 'CPT', category: 'E&M', description: 'Office visit, new patient, moderate complexity', rvu: 2.60, globalPeriod: 'XXX' },
  { code: '99205', type: 'CPT', category: 'E&M', description: 'Office visit, new patient, high complexity', rvu: 3.50, globalPeriod: 'XXX' },

  // === EVALUATION & MANAGEMENT - Office Visits (Established Patient) ===
  { code: '99211', type: 'CPT', category: 'E&M', description: 'Office visit, established patient, minimal', rvu: 0.18, globalPeriod: 'XXX' },
  { code: '99212', type: 'CPT', category: 'E&M', description: 'Office visit, established patient, straightforward', rvu: 0.70, globalPeriod: 'XXX' },
  { code: '99213', type: 'CPT', category: 'E&M', description: 'Office visit, established patient, low complexity', rvu: 1.30, globalPeriod: 'XXX' },
  { code: '99214', type: 'CPT', category: 'E&M', description: 'Office visit, established patient, moderate complexity', rvu: 1.92, globalPeriod: 'XXX' },
  { code: '99215', type: 'CPT', category: 'E&M', description: 'Office visit, established patient, high complexity', rvu: 2.80, globalPeriod: 'XXX' },

  // === EVALUATION & MANAGEMENT - Hospital Visits ===
  { code: '99221', type: 'CPT', category: 'E&M', description: 'Initial hospital care, straightforward/low', rvu: 1.92, globalPeriod: 'XXX' },
  { code: '99222', type: 'CPT', category: 'E&M', description: 'Initial hospital care, moderate complexity', rvu: 2.61, globalPeriod: 'XXX' },
  { code: '99223', type: 'CPT', category: 'E&M', description: 'Initial hospital care, high complexity', rvu: 3.86, globalPeriod: 'XXX' },
  { code: '99231', type: 'CPT', category: 'E&M', description: 'Subsequent hospital care, straightforward/low', rvu: 0.76, globalPeriod: 'XXX' },
  { code: '99232', type: 'CPT', category: 'E&M', description: 'Subsequent hospital care, moderate complexity', rvu: 1.39, globalPeriod: 'XXX' },
  { code: '99233', type: 'CPT', category: 'E&M', description: 'Subsequent hospital care, high complexity', rvu: 2.00, globalPeriod: 'XXX' },
  { code: '99238', type: 'CPT', category: 'E&M', description: 'Hospital discharge day, 30 min or less', rvu: 1.28, globalPeriod: 'XXX' },
  { code: '99239', type: 'CPT', category: 'E&M', description: 'Hospital discharge day, more than 30 min', rvu: 1.90, globalPeriod: 'XXX' },

  // === EVALUATION & MANAGEMENT - Emergency Department ===
  { code: '99281', type: 'CPT', category: 'E&M', description: 'ED visit, self-limited/minor problem', rvu: 0.45, globalPeriod: 'XXX' },
  { code: '99282', type: 'CPT', category: 'E&M', description: 'ED visit, low to moderate severity', rvu: 0.88, globalPeriod: 'XXX' },
  { code: '99283', type: 'CPT', category: 'E&M', description: 'ED visit, moderate severity', rvu: 1.34, globalPeriod: 'XXX' },
  { code: '99284', type: 'CPT', category: 'E&M', description: 'ED visit, high severity', rvu: 2.56, globalPeriod: 'XXX' },
  { code: '99285', type: 'CPT', category: 'E&M', description: 'ED visit, high severity with threat to life', rvu: 3.80, globalPeriod: 'XXX' },

  // === EVALUATION & MANAGEMENT - Consultations ===
  { code: '99241', type: 'CPT', category: 'E&M', description: 'Office consultation, straightforward', rvu: 0.64, globalPeriod: 'XXX' },
  { code: '99242', type: 'CPT', category: 'E&M', description: 'Office consultation, straightforward', rvu: 1.34, globalPeriod: 'XXX' },
  { code: '99243', type: 'CPT', category: 'E&M', description: 'Office consultation, low complexity', rvu: 2.00, globalPeriod: 'XXX' },
  { code: '99244', type: 'CPT', category: 'E&M', description: 'Office consultation, moderate complexity', rvu: 3.02, globalPeriod: 'XXX' },
  { code: '99245', type: 'CPT', category: 'E&M', description: 'Office consultation, high complexity', rvu: 3.78, globalPeriod: 'XXX' },

  // === EVALUATION & MANAGEMENT - Preventive Medicine ===
  { code: '99381', type: 'CPT', category: 'Preventive', description: 'Preventive visit, new patient, infant', rvu: 1.50, globalPeriod: 'XXX' },
  { code: '99385', type: 'CPT', category: 'Preventive', description: 'Preventive visit, new patient, 18-39', rvu: 1.70, globalPeriod: 'XXX' },
  { code: '99386', type: 'CPT', category: 'Preventive', description: 'Preventive visit, new patient, 40-64', rvu: 2.00, globalPeriod: 'XXX' },
  { code: '99387', type: 'CPT', category: 'Preventive', description: 'Preventive visit, new patient, 65+', rvu: 2.33, globalPeriod: 'XXX' },
  { code: '99391', type: 'CPT', category: 'Preventive', description: 'Preventive visit, established, infant', rvu: 1.37, globalPeriod: 'XXX' },
  { code: '99395', type: 'CPT', category: 'Preventive', description: 'Preventive visit, established, 18-39', rvu: 1.50, globalPeriod: 'XXX' },
  { code: '99396', type: 'CPT', category: 'Preventive', description: 'Preventive visit, established, 40-64', rvu: 1.68, globalPeriod: 'XXX' },
  { code: '99397', type: 'CPT', category: 'Preventive', description: 'Preventive visit, established, 65+', rvu: 1.88, globalPeriod: 'XXX' },

  // === EVALUATION & MANAGEMENT - Telehealth ===
  { code: '99441', type: 'CPT', category: 'Telehealth', description: 'Telephone E/M, 5-10 minutes', rvu: 0.25, globalPeriod: 'XXX' },
  { code: '99442', type: 'CPT', category: 'Telehealth', description: 'Telephone E/M, 11-20 minutes', rvu: 0.50, globalPeriod: 'XXX' },
  { code: '99443', type: 'CPT', category: 'Telehealth', description: 'Telephone E/M, 21-30 minutes', rvu: 0.75, globalPeriod: 'XXX' },

  // === PROCEDURES - Common ===
  { code: '10060', type: 'CPT', category: 'Surgery', description: 'Incision and drainage of abscess, simple', rvu: 1.22, globalPeriod: '010' },
  { code: '10061', type: 'CPT', category: 'Surgery', description: 'Incision and drainage of abscess, complicated', rvu: 2.65, globalPeriod: '010' },
  { code: '10120', type: 'CPT', category: 'Surgery', description: 'Removal of foreign body, simple', rvu: 1.69, globalPeriod: '010' },
  { code: '10140', type: 'CPT', category: 'Surgery', description: 'Incision and drainage of hematoma', rvu: 1.69, globalPeriod: '010' },
  { code: '11100', type: 'CPT', category: 'Surgery', description: 'Skin biopsy, single lesion', rvu: 0.81, globalPeriod: '000' },
  { code: '11101', type: 'CPT', category: 'Surgery', description: 'Skin biopsy, each additional lesion', rvu: 0.38, globalPeriod: 'ZZZ' },
  { code: '11200', type: 'CPT', category: 'Surgery', description: 'Removal of skin tags, up to 15', rvu: 0.80, globalPeriod: '010' },
  { code: '11300', type: 'CPT', category: 'Surgery', description: 'Shaving of lesion, trunk/arms/legs, 0.5 cm or less', rvu: 0.59, globalPeriod: '010' },
  { code: '12001', type: 'CPT', category: 'Surgery', description: 'Simple repair of wound, 2.5 cm or less', rvu: 1.42, globalPeriod: '010' },
  { code: '12002', type: 'CPT', category: 'Surgery', description: 'Simple repair of wound, 2.6-7.5 cm', rvu: 1.73, globalPeriod: '010' },
  { code: '17000', type: 'CPT', category: 'Surgery', description: 'Destruction of premalignant lesion, first', rvu: 0.61, globalPeriod: '010' },
  { code: '17110', type: 'CPT', category: 'Surgery', description: 'Destruction of warts, up to 14', rvu: 0.70, globalPeriod: '010' },

  // === INJECTIONS & INFUSIONS ===
  { code: '20610', type: 'CPT', category: 'Injection', description: 'Joint injection/aspiration, major joint', rvu: 1.11, globalPeriod: '000' },
  { code: '20600', type: 'CPT', category: 'Injection', description: 'Joint injection/aspiration, small joint', rvu: 0.60, globalPeriod: '000' },
  { code: '20605', type: 'CPT', category: 'Injection', description: 'Joint injection/aspiration, intermediate joint', rvu: 0.83, globalPeriod: '000' },
  { code: '96372', type: 'CPT', category: 'Injection', description: 'Therapeutic injection, subcutaneous/IM', rvu: 0.17, globalPeriod: 'XXX' },
  { code: '96374', type: 'CPT', category: 'Injection', description: 'Therapeutic IV push, single/initial', rvu: 0.52, globalPeriod: 'XXX' },
  { code: '96413', type: 'CPT', category: 'Infusion', description: 'Chemotherapy IV infusion, first hour', rvu: 1.63, globalPeriod: 'XXX' },

  // === LABORATORY ===
  { code: '36415', type: 'CPT', category: 'Lab', description: 'Venipuncture (blood draw)', rvu: 0.17, globalPeriod: 'XXX' },
  { code: '85025', type: 'CPT', category: 'Lab', description: 'CBC with differential', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '80048', type: 'CPT', category: 'Lab', description: 'Basic metabolic panel', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '80053', type: 'CPT', category: 'Lab', description: 'Comprehensive metabolic panel', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '80061', type: 'CPT', category: 'Lab', description: 'Lipid panel', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '83036', type: 'CPT', category: 'Lab', description: 'Hemoglobin A1c', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '81001', type: 'CPT', category: 'Lab', description: 'Urinalysis with microscopy', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '84443', type: 'CPT', category: 'Lab', description: 'TSH (thyroid stimulating hormone)', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '82947', type: 'CPT', category: 'Lab', description: 'Glucose, blood', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '82270', type: 'CPT', category: 'Lab', description: 'Fecal occult blood test', rvu: 0.00, globalPeriod: 'XXX' },

  // === IMAGING ===
  { code: '71046', type: 'CPT', category: 'Radiology', description: 'Chest X-ray, 2 views', rvu: 0.22, globalPeriod: 'XXX' },
  { code: '71045', type: 'CPT', category: 'Radiology', description: 'Chest X-ray, single view', rvu: 0.18, globalPeriod: 'XXX' },
  { code: '73030', type: 'CPT', category: 'Radiology', description: 'X-ray shoulder, minimum 2 views', rvu: 0.17, globalPeriod: 'XXX' },
  { code: '73560', type: 'CPT', category: 'Radiology', description: 'X-ray knee, 1-2 views', rvu: 0.16, globalPeriod: 'XXX' },
  { code: '73600', type: 'CPT', category: 'Radiology', description: 'X-ray ankle, 2 views', rvu: 0.15, globalPeriod: 'XXX' },
  { code: '70553', type: 'CPT', category: 'Radiology', description: 'MRI brain without and with contrast', rvu: 1.84, globalPeriod: 'XXX' },
  { code: '74177', type: 'CPT', category: 'Radiology', description: 'CT abdomen/pelvis with contrast', rvu: 1.74, globalPeriod: 'XXX' },
  { code: '93000', type: 'CPT', category: 'Cardiology', description: 'ECG, 12-lead with interpretation', rvu: 0.17, globalPeriod: 'XXX' },
  { code: '93306', type: 'CPT', category: 'Cardiology', description: 'Echocardiography, complete', rvu: 1.30, globalPeriod: 'XXX' },

  // === PSYCHIATRY ===
  { code: '90791', type: 'CPT', category: 'Psychiatry', description: 'Psychiatric diagnostic evaluation', rvu: 3.00, globalPeriod: 'XXX' },
  { code: '90832', type: 'CPT', category: 'Psychiatry', description: 'Psychotherapy, 30 minutes', rvu: 1.50, globalPeriod: 'XXX' },
  { code: '90834', type: 'CPT', category: 'Psychiatry', description: 'Psychotherapy, 45 minutes', rvu: 2.00, globalPeriod: 'XXX' },
  { code: '90837', type: 'CPT', category: 'Psychiatry', description: 'Psychotherapy, 60 minutes', rvu: 2.80, globalPeriod: 'XXX' },
  { code: '90847', type: 'CPT', category: 'Psychiatry', description: 'Family psychotherapy with patient', rvu: 2.30, globalPeriod: 'XXX' },

  // === IMMUNIZATIONS ===
  { code: '90471', type: 'CPT', category: 'Immunization', description: 'Immunization administration, first vaccine', rvu: 0.17, globalPeriod: 'XXX' },
  { code: '90472', type: 'CPT', category: 'Immunization', description: 'Immunization administration, each additional', rvu: 0.15, globalPeriod: 'XXX' },
  { code: '90658', type: 'CPT', category: 'Immunization', description: 'Influenza vaccine, trivalent', rvu: 0.00, globalPeriod: 'XXX' },
  { code: '90715', type: 'CPT', category: 'Immunization', description: 'Tdap vaccine', rvu: 0.00, globalPeriod: 'XXX' },

  // === CRITICAL CARE ===
  { code: '99291', type: 'CPT', category: 'Critical Care', description: 'Critical care, first 30-74 minutes', rvu: 4.50, globalPeriod: 'XXX' },
  { code: '99292', type: 'CPT', category: 'Critical Care', description: 'Critical care, each additional 30 minutes', rvu: 2.25, globalPeriod: 'XXX' },

  // === CARE MANAGEMENT ===
  { code: '99490', type: 'CPT', category: 'Care Management', description: 'Chronic care management, first 20 min/month', rvu: 0.61, globalPeriod: 'XXX' },
  { code: '99491', type: 'CPT', category: 'Care Management', description: 'Chronic care management, 30+ min/month', rvu: 1.28, globalPeriod: 'XXX' },
  { code: '99497', type: 'CPT', category: 'Care Management', description: 'Advance care planning, first 30 min', rvu: 1.50, globalPeriod: 'XXX' },
];

// ============================================================
// ICD-10-CM CODES - From CMS/CDC (Public Domain - No License)
// Most commonly used diagnosis codes in US healthcare
// ============================================================
const ICD10_CODES = [
  // === ENDOCRINE - Diabetes ===
  { code: 'E11.9', type: 'ICD10', category: 'Endocrine', description: 'Type 2 diabetes mellitus without complications', isValid: true },
  { code: 'E11.65', type: 'ICD10', category: 'Endocrine', description: 'Type 2 diabetes mellitus with hyperglycemia', isValid: true },
  { code: 'E11.40', type: 'ICD10', category: 'Endocrine', description: 'Type 2 diabetes with diabetic neuropathy, unspecified', isValid: true },
  { code: 'E11.51', type: 'ICD10', category: 'Endocrine', description: 'Type 2 diabetes with diabetic peripheral angiopathy without gangrene', isValid: true },
  { code: 'E11.311', type: 'ICD10', category: 'Endocrine', description: 'Type 2 diabetes with unspecified diabetic retinopathy with macular edema', isValid: true },
  { code: 'E11.21', type: 'ICD10', category: 'Endocrine', description: 'Type 2 diabetes with diabetic nephropathy', isValid: true },
  { code: 'E10.9', type: 'ICD10', category: 'Endocrine', description: 'Type 1 diabetes mellitus without complications', isValid: true },
  { code: 'E10.65', type: 'ICD10', category: 'Endocrine', description: 'Type 1 diabetes mellitus with hyperglycemia', isValid: true },
  { code: 'E03.9', type: 'ICD10', category: 'Endocrine', description: 'Hypothyroidism, unspecified', isValid: true },
  { code: 'E05.90', type: 'ICD10', category: 'Endocrine', description: 'Thyrotoxicosis, unspecified without thyrotoxic crisis', isValid: true },
  { code: 'E78.5', type: 'ICD10', category: 'Endocrine', description: 'Hyperlipidemia, unspecified', isValid: true },
  { code: 'E78.00', type: 'ICD10', category: 'Endocrine', description: 'Pure hypercholesterolemia, unspecified', isValid: true },
  { code: 'E66.01', type: 'ICD10', category: 'Endocrine', description: 'Morbid (severe) obesity due to excess calories', isValid: true },
  { code: 'E66.9', type: 'ICD10', category: 'Endocrine', description: 'Obesity, unspecified', isValid: true },

  // === CARDIOVASCULAR ===
  { code: 'I10', type: 'ICD10', category: 'Cardiovascular', description: 'Essential (primary) hypertension', isValid: true },
  { code: 'I11.9', type: 'ICD10', category: 'Cardiovascular', description: 'Hypertensive heart disease without heart failure', isValid: true },
  { code: 'I25.10', type: 'ICD10', category: 'Cardiovascular', description: 'Atherosclerotic heart disease of native coronary artery without angina', isValid: true },
  { code: 'I48.91', type: 'ICD10', category: 'Cardiovascular', description: 'Unspecified atrial fibrillation', isValid: true },
  { code: 'I48.0', type: 'ICD10', category: 'Cardiovascular', description: 'Paroxysmal atrial fibrillation', isValid: true },
  { code: 'I50.9', type: 'ICD10', category: 'Cardiovascular', description: 'Heart failure, unspecified', isValid: true },
  { code: 'I50.22', type: 'ICD10', category: 'Cardiovascular', description: 'Chronic systolic (congestive) heart failure', isValid: true },
  { code: 'I63.9', type: 'ICD10', category: 'Cardiovascular', description: 'Cerebral infarction, unspecified', isValid: true },
  { code: 'I73.9', type: 'ICD10', category: 'Cardiovascular', description: 'Peripheral vascular disease, unspecified', isValid: true },
  { code: 'I21.9', type: 'ICD10', category: 'Cardiovascular', description: 'Acute myocardial infarction, unspecified', isValid: true },

  // === RESPIRATORY ===
  { code: 'J06.9', type: 'ICD10', category: 'Respiratory', description: 'Acute upper respiratory infection, unspecified', isValid: true },
  { code: 'J18.9', type: 'ICD10', category: 'Respiratory', description: 'Pneumonia, unspecified organism', isValid: true },
  { code: 'J44.1', type: 'ICD10', category: 'Respiratory', description: 'COPD with acute exacerbation', isValid: true },
  { code: 'J44.9', type: 'ICD10', category: 'Respiratory', description: 'COPD, unspecified', isValid: true },
  { code: 'J45.20', type: 'ICD10', category: 'Respiratory', description: 'Mild intermittent asthma, uncomplicated', isValid: true },
  { code: 'J45.30', type: 'ICD10', category: 'Respiratory', description: 'Mild persistent asthma, uncomplicated', isValid: true },
  { code: 'J45.40', type: 'ICD10', category: 'Respiratory', description: 'Moderate persistent asthma, uncomplicated', isValid: true },
  { code: 'J45.50', type: 'ICD10', category: 'Respiratory', description: 'Severe persistent asthma, uncomplicated', isValid: true },
  { code: 'J02.9', type: 'ICD10', category: 'Respiratory', description: 'Acute pharyngitis, unspecified', isValid: true },
  { code: 'J20.9', type: 'ICD10', category: 'Respiratory', description: 'Acute bronchitis, unspecified', isValid: true },

  // === MUSCULOSKELETAL ===
  { code: 'M54.5', type: 'ICD10', category: 'Musculoskeletal', description: 'Low back pain', isValid: true },
  { code: 'M79.3', type: 'ICD10', category: 'Musculoskeletal', description: 'Panniculitis, unspecified', isValid: true },
  { code: 'M25.511', type: 'ICD10', category: 'Musculoskeletal', description: 'Pain in right shoulder', isValid: true },
  { code: 'M25.561', type: 'ICD10', category: 'Musculoskeletal', description: 'Pain in right knee', isValid: true },
  { code: 'M17.11', type: 'ICD10', category: 'Musculoskeletal', description: 'Primary osteoarthritis, right knee', isValid: true },
  { code: 'M17.9', type: 'ICD10', category: 'Musculoskeletal', description: 'Osteoarthritis of knee, unspecified', isValid: true },
  { code: 'M19.90', type: 'ICD10', category: 'Musculoskeletal', description: 'Unspecified osteoarthritis, unspecified site', isValid: true },
  { code: 'M54.2', type: 'ICD10', category: 'Musculoskeletal', description: 'Cervicalgia (neck pain)', isValid: true },
  { code: 'M62.838', type: 'ICD10', category: 'Musculoskeletal', description: 'Other muscle spasm', isValid: true },
  { code: 'M79.1', type: 'ICD10', category: 'Musculoskeletal', description: 'Myalgia', isValid: true },

  // === MENTAL HEALTH ===
  { code: 'F32.0', type: 'ICD10', category: 'Mental Health', description: 'Major depressive disorder, single episode, mild', isValid: true },
  { code: 'F32.1', type: 'ICD10', category: 'Mental Health', description: 'Major depressive disorder, single episode, moderate', isValid: true },
  { code: 'F32.9', type: 'ICD10', category: 'Mental Health', description: 'Major depressive disorder, single episode, unspecified', isValid: true },
  { code: 'F33.0', type: 'ICD10', category: 'Mental Health', description: 'Major depressive disorder, recurrent, mild', isValid: true },
  { code: 'F33.1', type: 'ICD10', category: 'Mental Health', description: 'Major depressive disorder, recurrent, moderate', isValid: true },
  { code: 'F41.1', type: 'ICD10', category: 'Mental Health', description: 'Generalized anxiety disorder', isValid: true },
  { code: 'F41.0', type: 'ICD10', category: 'Mental Health', description: 'Panic disorder without agoraphobia', isValid: true },
  { code: 'F43.10', type: 'ICD10', category: 'Mental Health', description: 'Post-traumatic stress disorder, unspecified', isValid: true },
  { code: 'F90.0', type: 'ICD10', category: 'Mental Health', description: 'ADHD, predominantly inattentive type', isValid: true },
  { code: 'F90.2', type: 'ICD10', category: 'Mental Health', description: 'ADHD, combined type', isValid: true },
  { code: 'F10.20', type: 'ICD10', category: 'Mental Health', description: 'Alcohol dependence, uncomplicated', isValid: true },
  { code: 'F17.210', type: 'ICD10', category: 'Mental Health', description: 'Nicotine dependence, cigarettes, uncomplicated', isValid: true },

  // === GASTROINTESTINAL ===
  { code: 'K21.0', type: 'ICD10', category: 'GI', description: 'GERD with esophagitis', isValid: true },
  { code: 'K21.9', type: 'ICD10', category: 'GI', description: 'GERD without esophagitis', isValid: true },
  { code: 'K58.9', type: 'ICD10', category: 'GI', description: 'Irritable bowel syndrome without diarrhea', isValid: true },
  { code: 'K50.90', type: 'ICD10', category: 'GI', description: 'Crohn disease, unspecified, without complications', isValid: true },
  { code: 'K51.90', type: 'ICD10', category: 'GI', description: 'Ulcerative colitis, unspecified, without complications', isValid: true },
  { code: 'K76.0', type: 'ICD10', category: 'GI', description: 'Fatty liver disease, not elsewhere classified', isValid: true },
  { code: 'K59.00', type: 'ICD10', category: 'GI', description: 'Constipation, unspecified', isValid: true },

  // === GENITOURINARY ===
  { code: 'N39.0', type: 'ICD10', category: 'GU', description: 'Urinary tract infection, site not specified', isValid: true },
  { code: 'N18.3', type: 'ICD10', category: 'GU', description: 'Chronic kidney disease, stage 3', isValid: true },
  { code: 'N18.4', type: 'ICD10', category: 'GU', description: 'Chronic kidney disease, stage 4', isValid: true },
  { code: 'N18.9', type: 'ICD10', category: 'GU', description: 'Chronic kidney disease, unspecified', isValid: true },
  { code: 'N40.0', type: 'ICD10', category: 'GU', description: 'Benign prostatic hyperplasia without LUTS', isValid: true },

  // === NEUROLOGICAL ===
  { code: 'G43.909', type: 'ICD10', category: 'Neurological', description: 'Migraine, unspecified, not intractable, without status migrainosus', isValid: true },
  { code: 'G47.00', type: 'ICD10', category: 'Neurological', description: 'Insomnia, unspecified', isValid: true },
  { code: 'G47.33', type: 'ICD10', category: 'Neurological', description: 'Obstructive sleep apnea', isValid: true },
  { code: 'G40.909', type: 'ICD10', category: 'Neurological', description: 'Epilepsy, unspecified, not intractable, without status epilepticus', isValid: true },
  { code: 'G20', type: 'ICD10', category: 'Neurological', description: 'Parkinson disease', isValid: true },
  { code: 'G30.9', type: 'ICD10', category: 'Neurological', description: 'Alzheimer disease, unspecified', isValid: true },

  // === SKIN ===
  { code: 'L30.9', type: 'ICD10', category: 'Skin', description: 'Dermatitis, unspecified', isValid: true },
  { code: 'L40.0', type: 'ICD10', category: 'Skin', description: 'Psoriasis vulgaris', isValid: true },
  { code: 'L50.9', type: 'ICD10', category: 'Skin', description: 'Urticaria, unspecified', isValid: true },
  { code: 'L70.0', type: 'ICD10', category: 'Skin', description: 'Acne vulgaris', isValid: true },

  // === HEMATOLOGIC ===
  { code: 'D64.9', type: 'ICD10', category: 'Hematologic', description: 'Anemia, unspecified', isValid: true },
  { code: 'D50.9', type: 'ICD10', category: 'Hematologic', description: 'Iron deficiency anemia, unspecified', isValid: true },
  { code: 'D69.6', type: 'ICD10', category: 'Hematologic', description: 'Thrombocytopenia, unspecified', isValid: true },

  // === INFECTIOUS ===
  { code: 'B34.9', type: 'ICD10', category: 'Infectious', description: 'Viral infection, unspecified', isValid: true },
  { code: 'A09', type: 'ICD10', category: 'Infectious', description: 'Infectious gastroenteritis and colitis, unspecified', isValid: true },
  { code: 'U07.1', type: 'ICD10', category: 'Infectious', description: 'COVID-19', isValid: true },
  { code: 'B00.9', type: 'ICD10', category: 'Infectious', description: 'Herpesviral infection, unspecified', isValid: true },

  // === SYMPTOMS & SIGNS ===
  { code: 'R10.9', type: 'ICD10', category: 'Symptoms', description: 'Unspecified abdominal pain', isValid: true },
  { code: 'R05.9', type: 'ICD10', category: 'Symptoms', description: 'Cough, unspecified', isValid: true },
  { code: 'R50.9', type: 'ICD10', category: 'Symptoms', description: 'Fever, unspecified', isValid: true },
  { code: 'R51.9', type: 'ICD10', category: 'Symptoms', description: 'Headache, unspecified', isValid: true },
  { code: 'R53.83', type: 'ICD10', category: 'Symptoms', description: 'Other fatigue', isValid: true },
  { code: 'R42', type: 'ICD10', category: 'Symptoms', description: 'Dizziness and giddiness', isValid: true },
  { code: 'R07.9', type: 'ICD10', category: 'Symptoms', description: 'Chest pain, unspecified', isValid: true },
  { code: 'R06.02', type: 'ICD10', category: 'Symptoms', description: 'Shortness of breath', isValid: true },
  { code: 'R11.0', type: 'ICD10', category: 'Symptoms', description: 'Nausea', isValid: true },
  { code: 'R11.10', type: 'ICD10', category: 'Symptoms', description: 'Vomiting, unspecified', isValid: true },

  // === INJURY & EXTERNAL CAUSES ===
  { code: 'S93.401A', type: 'ICD10', category: 'Injury', description: 'Sprain of unspecified ligament of right ankle, initial', isValid: true },
  { code: 'S83.511A', type: 'ICD10', category: 'Injury', description: 'Sprain of anterior cruciate ligament of right knee, initial', isValid: true },
  { code: 'S62.009A', type: 'ICD10', category: 'Injury', description: 'Unspecified fracture of unspecified navicular bone of wrist, initial', isValid: true },

  // === WELLNESS/PREVENTIVE ===
  { code: 'Z00.00', type: 'ICD10', category: 'Wellness', description: 'General adult medical exam without abnormal findings', isValid: true },
  { code: 'Z00.01', type: 'ICD10', category: 'Wellness', description: 'General adult medical exam with abnormal findings', isValid: true },
  { code: 'Z23', type: 'ICD10', category: 'Wellness', description: 'Encounter for immunization', isValid: true },
  { code: 'Z12.31', type: 'ICD10', category: 'Wellness', description: 'Encounter for screening mammogram', isValid: true },
  { code: 'Z12.11', type: 'ICD10', category: 'Wellness', description: 'Encounter for screening for malignant neoplasm of colon', isValid: true },
  { code: 'Z87.891', type: 'ICD10', category: 'Wellness', description: 'Personal history of nicotine dependence', isValid: true },
  { code: 'Z79.4', type: 'ICD10', category: 'Wellness', description: 'Long term (current) use of insulin', isValid: true },
  { code: 'Z79.899', type: 'ICD10', category: 'Wellness', description: 'Other long term (current) drug therapy', isValid: true },
];

async function seedBillingCodes() {
  let client;

  try {
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    // Check existing count
    const existingCount = await collection.countDocuments();
    console.log(`Existing billing codes in database: ${existingCount}`);

    if (existingCount > 0) {
      console.log('Billing codes already exist. Dropping and re-seeding...');
      await collection.deleteMany({});
    }

    // Combine all codes
    const allCodes = [
      ...CPT_CODES.map(c => ({ ...c, active: true, createdAt: new Date() })),
      ...ICD10_CODES.map(c => ({ ...c, active: true, createdAt: new Date() }))
    ];

    // Insert all codes
    const result = await collection.insertMany(allCodes);
    console.log(`\n✅ Successfully seeded ${result.insertedCount} billing codes:`);
    console.log(`   - ${CPT_CODES.length} CPT codes`);
    console.log(`   - ${ICD10_CODES.length} ICD-10 codes`);

    // Create indexes for fast lookup
    await collection.createIndex({ code: 1, type: 1 }, { unique: true });
    await collection.createIndex({ type: 1, active: 1 });
    await collection.createIndex({ category: 1 });
    console.log('   - Created indexes on code+type, type+active, category');

    // Summary by category
    const cptCategories = {};
    CPT_CODES.forEach(c => { cptCategories[c.category] = (cptCategories[c.category] || 0) + 1; });
    console.log('\nCPT codes by category:');
    Object.entries(cptCategories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

    const icdCategories = {};
    ICD10_CODES.forEach(c => { icdCategories[c.category] = (icdCategories[c.category] || 0) + 1; });
    console.log('\nICD-10 codes by category:');
    Object.entries(icdCategories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

    console.log('\n📋 Free code sources for future expansion:');
    console.log('   ICD-10: https://www.cdc.gov/nchs/icd/icd-10-cm/files.html (70,000+ codes)');
    console.log('   HCPCS:  https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system');
    console.log('   PFS:    https://www.cms.gov/medicare/physician-fee-schedule/search');

  } catch (error) {
    console.error('Failed to seed billing codes:', error);
    process.exit(1);
  } finally {
    if (client) await client.close();
    console.log('\nDone.');
    process.exit(0);
  }
}

seedBillingCodes();
