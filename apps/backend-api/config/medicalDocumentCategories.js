/**
 * Medical Document Categories - Master List
 *
 * This file defines all possible medical document categories that Claude AI
 * can classify PDFs into during batch processing.
 *
 * Each category corresponds to:
 * 1. A unified_medical_documents category field
 * 2. A frontend template in templates/
 * 3. A PDF export template in pdf-templates/
 *
 * WORKFLOW:
 * 1. Claude analyzes PDF during batch processing
 * 2. Claude selects best matching category from this list
 * 3. Category stored in unified_medical_documents.category field
 * 4. Frontend routes to appropriate template based on category
 *
 * ADDING NEW CATEGORIES:
 * 1. Add category to array below
 * 2. Create React template: templates/{Category}Document.jsx
 * 3. Create CSS: templates/{Category}Document.css
 * 4. Create PDF template: pdf-templates/{Category}PDFTemplate.jsx
 * 5. Add pattern to AIDocumentRenderer.jsx TEMPLATE_PATTERNS array
 */

module.exports = {
  /**
   * Master list of medical document categories
   * Claude AI will choose from this list when classifying PDFs
   */
  MEDICAL_DOCUMENT_CATEGORIES: [
    // ========== ALLERGY & IMMUNOLOGY ==========
    {
      name: 'allergy_immunology_assessment',
      displayName: 'Allergy & Immunology Assessment',
      specialty: 'Allergy & Immunology',
      description: 'Allergy testing, immunology evaluation, asthma assessment',
      keywords: ['allergy', 'immunology', 'asthma', 'IgE', 'skin testing']
    },

    // ========== ANESTHESIOLOGY ==========
    {
      name: 'anesthesia_preoperative_assessment',
      displayName: 'Anesthesia Preoperative Assessment',
      specialty: 'Anesthesiology',
      description: 'Preoperative anesthesia evaluation and planning',
      keywords: ['anesthesia', 'preop', 'ASA classification', 'airway assessment']
    },
    {
      name: 'anesthesia_records',
      displayName: 'Anesthesia Record',
      specialty: 'Anesthesiology',
      description: 'Intraoperative anesthesia documentation',
      keywords: ['anesthesia', 'intraoperative', 'vital signs', 'medications']
    },

    // ========== CARDIOLOGY ==========
    {
      name: 'cardiology_admission_notes',
      displayName: 'Cardiology Admission Note',
      specialty: 'Cardiology',
      description: 'Acute coronary syndrome, heart failure, arrhythmia admission',
      keywords: ['cardiology', 'admission', 'ACS', 'heart failure', 'MI']
    },
    {
      name: 'cardiology_consultation',
      displayName: 'Cardiology Consultation',
      specialty: 'Cardiology',
      description: 'Cardiology consultation and recommendations',
      keywords: ['cardiology', 'consultation', 'ECG', 'echo', 'cardiac']
    },
    {
      name: 'cardiology_followup',
      displayName: 'Cardiology Follow-up',
      specialty: 'Cardiology',
      description: 'Cardiology follow-up visit after intervention or hospitalization',
      keywords: ['cardiology', 'follow-up', 'post-discharge', 'cardiac rehab']
    },

    // ========== SURGERY - COLORECTAL ==========
    {
      name: 'colorectal_surgery_consultation',
      displayName: 'Colorectal Surgery Consultation',
      specialty: 'Colorectal Surgery',
      description: 'Colorectal surgical evaluation and planning',
      keywords: ['colorectal', 'surgery', 'colon', 'rectal', 'IBD']
    },

    // ========== DERMATOLOGY ==========
    {
      name: 'dermatology_consultation',
      displayName: 'Dermatology Consultation',
      specialty: 'Dermatology',
      description: 'Skin condition evaluation and treatment plan',
      keywords: ['dermatology', 'skin', 'rash', 'biopsy', 'lesion']
    },

    // ========== EMERGENCY MEDICINE ==========
    {
      name: 'emergency_department_report',
      displayName: 'Emergency Department Report',
      specialty: 'Emergency Medicine',
      description: 'ED visit documentation and disposition',
      keywords: ['emergency', 'ED', 'ER', 'triage', 'trauma']
    },
    {
      name: 'emergency_discharge_summary',
      displayName: 'Emergency Department Discharge Summary',
      specialty: 'Emergency Medicine',
      description: 'ED discharge instructions and follow-up',
      keywords: ['emergency', 'discharge', 'ED', 'follow-up']
    },

    // ========== ENDOCRINOLOGY ==========
    {
      name: 'endocrinology_diabetes_management',
      displayName: 'Endocrinology Diabetes Management',
      specialty: 'Endocrinology',
      description: 'Diabetes management visit, insulin adjustment, A1C review',
      keywords: ['endocrinology', 'diabetes', 'insulin', 'glucose', 'A1C']
    },
    {
      name: 'endocrinology_consultation',
      displayName: 'Endocrinology Consultation',
      specialty: 'Endocrinology',
      description: 'Endocrine disorder evaluation (thyroid, adrenal, pituitary)',
      keywords: ['endocrinology', 'thyroid', 'hormone', 'metabolic']
    },

    // ========== ENT (OTOLARYNGOLOGY) ==========
    {
      name: 'ent_consultation',
      displayName: 'ENT Consultation',
      specialty: 'Otolaryngology (ENT)',
      description: 'Ear, nose, throat evaluation and treatment',
      keywords: ['ENT', 'otolaryngology', 'ear', 'nose', 'throat', 'sinus']
    },

    // ========== FAMILY MEDICINE ==========
    {
      name: 'family_medicine_visit',
      displayName: 'Family Medicine Visit',
      specialty: 'Family Medicine',
      description: 'Primary care visit, preventive care, chronic disease management',
      keywords: ['family medicine', 'primary care', 'preventive', 'annual exam']
    },

    // ========== GASTROENTEROLOGY ==========
    {
      name: 'gastroenterology_ibd_consultation',
      displayName: 'Gastroenterology IBD Consultation',
      specialty: 'Gastroenterology',
      description: 'Inflammatory bowel disease management (Crohn\'s, UC)',
      keywords: ['gastroenterology', 'IBD', 'Crohn', 'ulcerative colitis', 'colonoscopy']
    },
    {
      name: 'gastroenterology_consultation',
      displayName: 'Gastroenterology Consultation',
      specialty: 'Gastroenterology',
      description: 'GI consultation for various digestive disorders',
      keywords: ['gastroenterology', 'GI', 'digestive', 'endoscopy']
    },

    // ========== GERIATRICS ==========
    {
      name: 'geriatric_comprehensive_assessment',
      displayName: 'Geriatric Comprehensive Assessment',
      specialty: 'Geriatrics',
      description: 'Comprehensive geriatric assessment including functional, cognitive, and social evaluation',
      keywords: ['geriatric', 'elderly', 'functional assessment', 'falls', 'dementia']
    },

    // ========== HEMATOLOGY ==========
    {
      name: 'hematology_consultation',
      displayName: 'Hematology Consultation',
      specialty: 'Hematology',
      description: 'Blood disorder evaluation and treatment',
      keywords: ['hematology', 'blood', 'anemia', 'coagulation', 'CBC']
    },
    {
      name: 'hematology_oncology_new_diagnosis',
      displayName: 'Hematology-Oncology New Diagnosis',
      specialty: 'Hematology-Oncology',
      description: 'New cancer or blood disorder diagnosis consultation',
      keywords: ['hematology', 'oncology', 'cancer', 'lymphoma', 'leukemia']
    },

    // ========== HOSPITAL DISCHARGE ==========
    {
      name: 'hospital_discharge_summary',
      displayName: 'Hospital Discharge Summary',
      specialty: 'Hospital Medicine',
      description: 'Comprehensive hospital discharge summary',
      keywords: ['discharge', 'hospital', 'admission', 'inpatient']
    },

    // ========== INFECTIOUS DISEASE ==========
    {
      name: 'infectious_disease_consultation',
      displayName: 'Infectious Disease Consultation',
      specialty: 'Infectious Disease',
      description: 'Infectious disease evaluation and antibiotic management',
      keywords: ['infectious disease', 'infection', 'antibiotic', 'HIV', 'sepsis']
    },

    // ========== INTERNAL MEDICINE ==========
    {
      name: 'internal_medicine_consultation',
      displayName: 'Internal Medicine Consultation',
      specialty: 'Internal Medicine',
      description: 'General internal medicine consultation',
      keywords: ['internal medicine', 'general medicine', 'adult medicine']
    },

    // ========== MATERNAL-FETAL MEDICINE ==========
    {
      name: 'maternal_fetal_medicine_consultation',
      displayName: 'Maternal-Fetal Medicine Consultation',
      specialty: 'Maternal-Fetal Medicine',
      description: 'High-risk pregnancy evaluation and management',
      keywords: ['maternal-fetal', 'high-risk pregnancy', 'prenatal', 'ultrasound']
    },

    // ========== MEDICAL GENETICS ==========
    {
      name: 'medical_genetics_consultation',
      displayName: 'Medical Genetics Consultation',
      specialty: 'Medical Genetics',
      description: 'Genetic counseling and testing recommendations',
      keywords: ['genetics', 'genetic testing', 'hereditary', 'chromosome']
    },

    // ========== NEPHROLOGY ==========
    {
      name: 'nephrology_ckd_consultation',
      displayName: 'Nephrology CKD Consultation',
      specialty: 'Nephrology',
      description: 'Chronic kidney disease management and dialysis planning',
      keywords: ['nephrology', 'kidney', 'CKD', 'dialysis', 'creatinine']
    },
    {
      name: 'nephrology_consultation',
      displayName: 'Nephrology Consultation',
      specialty: 'Nephrology',
      description: 'Kidney disease evaluation and treatment',
      keywords: ['nephrology', 'kidney', 'renal', 'electrolyte']
    },

    // ========== NEUROLOGY ==========
    {
      name: 'neurology_clinic_progress_note',
      displayName: 'Neurology Clinic Progress Note',
      specialty: 'Neurology',
      description: 'Neurology follow-up visit for chronic neurological conditions',
      keywords: ['neurology', 'neurological', 'seizure', 'stroke', 'headache']
    },
    {
      name: 'neurology_consultation',
      displayName: 'Neurology Consultation',
      specialty: 'Neurology',
      description: 'Neurological evaluation and diagnosis',
      keywords: ['neurology', 'neurological', 'brain', 'nerve']
    },

    // ========== NEUROSURGERY ==========
    {
      name: 'neurosurgery_consultation',
      displayName: 'Neurosurgery Consultation',
      specialty: 'Neurosurgery',
      description: 'Neurosurgical evaluation and operative planning',
      keywords: ['neurosurgery', 'brain surgery', 'spine surgery', 'craniotomy']
    },

    // ========== NUCLEAR MEDICINE ==========
    {
      name: 'nuclear_medicine_report',
      displayName: 'Nuclear Medicine Report',
      specialty: 'Nuclear Medicine',
      description: 'Nuclear medicine imaging study report',
      keywords: ['nuclear medicine', 'PET scan', 'bone scan', 'thyroid scan']
    },

    // ========== OBSTETRICS ==========
    {
      name: 'obstetric_prenatal_visit',
      displayName: 'Obstetric Prenatal Visit',
      specialty: 'Obstetrics',
      description: 'Routine prenatal care visit',
      keywords: ['obstetric', 'prenatal', 'pregnancy', 'OB', 'ultrasound']
    },

    // ========== ONCOLOGY ==========
    {
      name: 'oncology_treatment_summary',
      displayName: 'Oncology Treatment Summary',
      specialty: 'Oncology',
      description: 'Cancer treatment summary and follow-up plan',
      keywords: ['oncology', 'cancer', 'chemotherapy', 'radiation', 'tumor']
    },

    // ========== OPERATIVE REPORTS ==========
    {
      name: 'operative_report',
      displayName: 'Operative Report',
      specialty: 'Surgery',
      description: 'Detailed surgical procedure documentation',
      keywords: ['operative', 'surgery', 'procedure', 'operation']
    },

    // ========== OPHTHALMOLOGY ==========
    {
      name: 'ophthalmology_exam',
      displayName: 'Ophthalmology Examination',
      specialty: 'Ophthalmology',
      description: 'Eye examination and vision assessment',
      keywords: ['ophthalmology', 'eye', 'vision', 'retina', 'glaucoma']
    },

    // ========== ORTHOPEDIC SURGERY ==========
    {
      name: 'orthopedic_postoperative_report',
      displayName: 'Orthopedic Post-Operative Report',
      specialty: 'Orthopedic Surgery',
      description: 'Post-operative follow-up after orthopedic surgery',
      keywords: ['orthopedic', 'post-op', 'fracture', 'joint', 'bone']
    },
    {
      name: 'orthopedic_consultation',
      displayName: 'Orthopedic Consultation',
      specialty: 'Orthopedic Surgery',
      description: 'Orthopedic evaluation and treatment planning',
      keywords: ['orthopedic', 'musculoskeletal', 'fracture', 'joint']
    },

    // ========== PATHOLOGY ==========
    {
      name: 'pathology_report',
      displayName: 'Pathology Report',
      specialty: 'Pathology',
      description: 'Tissue biopsy or surgical specimen pathology report',
      keywords: ['pathology', 'biopsy', 'specimen', 'histology', 'cytology']
    },

    // ========== PEDIATRICS ==========
    {
      name: 'pediatric_well_child_visit',
      displayName: 'Pediatric Well-Child Visit',
      specialty: 'Pediatrics',
      description: 'Routine pediatric preventive care and development assessment',
      keywords: ['pediatric', 'well-child', 'vaccination', 'growth', 'development']
    },
    {
      name: 'pediatric_examination',
      displayName: 'Pediatric Examination',
      specialty: 'Pediatrics',
      description: 'Pediatric sick visit or examination',
      keywords: ['pediatric', 'child', 'infant', 'adolescent']
    },

    // ========== PLASTIC SURGERY ==========
    {
      name: 'plastic_surgery_consultation',
      displayName: 'Plastic Surgery Consultation',
      specialty: 'Plastic Surgery',
      description: 'Plastic or reconstructive surgery consultation',
      keywords: ['plastic surgery', 'reconstructive', 'cosmetic']
    },

    // ========== PHYSICAL MEDICINE & REHABILITATION ==========
    {
      name: 'pmr_evaluation',
      displayName: 'PM&R Evaluation',
      specialty: 'Physical Medicine & Rehabilitation',
      description: 'Physical medicine and rehabilitation evaluation',
      keywords: ['PM&R', 'rehabilitation', 'physical therapy', 'functional assessment']
    },

    // ========== PREVENTIVE MEDICINE ==========
    {
      name: 'preventive_medicine_visit',
      displayName: 'Preventive Medicine Visit',
      specialty: 'Preventive Medicine',
      description: 'Preventive care and health screening visit',
      keywords: ['preventive', 'screening', 'wellness', 'health maintenance']
    },

    // ========== PSYCHIATRY ==========
    {
      name: 'psychiatric_evaluation',
      displayName: 'Psychiatric Evaluation',
      specialty: 'Psychiatry',
      description: 'Psychiatric assessment and diagnosis',
      keywords: ['psychiatric', 'mental health', 'depression', 'anxiety']
    },
    {
      name: 'psychiatric_evaluation_treatment_plan',
      displayName: 'Psychiatric Evaluation & Treatment Plan',
      specialty: 'Psychiatry',
      description: 'Comprehensive psychiatric evaluation with treatment plan',
      keywords: ['psychiatric', 'mental health', 'psychotherapy', 'medication management']
    },

    // ========== PULMONOLOGY ==========
    {
      name: 'pulmonology_asthma_consultation',
      displayName: 'Pulmonology Asthma Consultation',
      specialty: 'Pulmonology',
      description: 'Asthma management and pulmonary function testing',
      keywords: ['pulmonology', 'asthma', 'COPD', 'respiratory', 'PFT']
    },
    {
      name: 'pulmonology_consultation',
      displayName: 'Pulmonology Consultation',
      specialty: 'Pulmonology',
      description: 'Pulmonary disease evaluation and treatment',
      keywords: ['pulmonology', 'lung', 'respiratory', 'breathing']
    },

    // ========== RADIOLOGY ==========
    {
      name: 'radiology_report',
      displayName: 'Radiology Report',
      specialty: 'Radiology',
      description: 'Imaging study interpretation (X-ray, CT, MRI)',
      keywords: ['radiology', 'imaging', 'X-ray', 'CT', 'MRI']
    },

    // ========== RHEUMATOLOGY ==========
    {
      name: 'rheumatology_consultation',
      displayName: 'Rheumatology Consultation',
      specialty: 'Rheumatology',
      description: 'Rheumatic disease evaluation and treatment',
      keywords: ['rheumatology', 'arthritis', 'autoimmune', 'lupus', 'RA']
    },

    // ========== THORACIC SURGERY ==========
    {
      name: 'thoracic_surgery_consultation',
      displayName: 'Thoracic Surgery Consultation',
      specialty: 'Thoracic Surgery',
      description: 'Thoracic surgical evaluation and planning',
      keywords: ['thoracic surgery', 'lung surgery', 'chest', 'esophagus']
    },

    // ========== UROLOGY ==========
    {
      name: 'urology_consultation',
      displayName: 'Urology Consultation',
      specialty: 'Urology',
      description: 'Urological evaluation and treatment',
      keywords: ['urology', 'urological', 'prostate', 'bladder', 'kidney stone']
    },

    // ========== MONITORING & THERAPY ==========
    {
      name: 'monitoring_therapy_report',
      displayName: 'Monitoring & Therapy Report',
      specialty: 'Various',
      description: 'Ongoing monitoring and therapy tracking report',
      keywords: ['monitoring', 'therapy', 'tracking', 'progress']
    },

    // ========== GENERIC (UNKNOWN) ==========
    {
      name: 'medical_document_generic',
      displayName: 'Medical Document (Generic)',
      specialty: 'Various',
      description: 'General medical document that doesn\'t fit other categories',
      keywords: ['medical', 'document', 'generic']
    }
  ],

  /**
   * Get category by name
   */
  getCategoryByName(name) {
    return this.MEDICAL_DOCUMENT_CATEGORIES.find(cat => cat.name === name);
  },

  /**
   * Get all category names (for Claude AI classification)
   */
  getAllCategoryNames() {
    return this.MEDICAL_DOCUMENT_CATEGORIES.map(cat => cat.name);
  },

  /**
   * Get categories by specialty
   */
  getCategoriesBySpecialty(specialty) {
    return this.MEDICAL_DOCUMENT_CATEGORIES.filter(cat => cat.specialty === specialty);
  },

  /**
   * Format categories for Claude AI prompt
   */
  formatCategoriesForPrompt() {
    return this.MEDICAL_DOCUMENT_CATEGORIES.map((cat, index) =>
      `${index + 1}. ${cat.name} - ${cat.displayName} (${cat.specialty})\n   ${cat.description}\n   Keywords: ${cat.keywords.join(', ')}`
    ).join('\n\n');
  }
};
