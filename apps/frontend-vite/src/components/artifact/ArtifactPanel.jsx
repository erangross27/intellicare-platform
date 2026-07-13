import React, { useState, useEffect, useRef } from 'react';
import CategoryListView from './CategoryListView';
import DocumentListView from './DocumentListView';
import DocumentDetailView from './DocumentDetailView';
import GridCollectionView from './GridCollectionView';
import CollectionDocumentView from './CollectionDocumentView';
import DirectGridView from './DirectGridView';
import CollectionSelectorView from './CollectionSelectorView';
import './ArtifactPanel.css';

/**
 * ArtifactPanel - Main wrapper component for artifact-style document viewer
 *
 * Manages 3-level navigation:
 * - Level 1: Category list (show all medical data categories)
 * - Level 2: Document list (show documents in selected category)
 * - Level 3: Document detail (show full document with template)
 *
 * Props:
 * - isOpen: boolean - whether panel is visible
 * - onClose: function - callback to close panel
 * - patientId: string - current patient ID
 * - initialLevel: string - optional starting level ('categories', 'documents', 'detail')
 * - initialCategory: string - optional starting category
 * - initialDocumentId: string - optional starting document
 */
const ArtifactPanel = ({
  isOpen,
  onClose,
  patientId,
  initialLevel = 'categories',
  initialCategory = null,
  initialDocumentId = null,
  onNavigate,
  directGridData = null,  // NEW: Direct grid data from function results
  onDataFetched = null,   // NEW: Callback when document data is fetched
  initialCategories = null, // NEW: Pre-fetched categories from getCollectionsWithData
  onSendMessage = null,   // NEW: Send message to Claude when category clicked
  patientName = null      // NEW: Patient name for constructing messages
}) => {
  // Navigation state
  const [state, setState] = useState({
    level: initialLevel,           // 'categories' | 'collection-selector' | 'documents' | 'detail' | 'grid' | 'direct-grid'
    selectedCategory: initialCategory,
    selectedCategoryData: null,     // Full category object with displayMode
    selectedDocument: null,
    documentId: initialDocumentId,
    gridData: directGridData,       // Direct grid data
    categoriesData: initialCategories, // Pre-fetched categories
    hasMultipleCategoriesRoot: initialCategories && initialCategories.length > 1, // Track if we started with multiple categories
    // CRITICAL: Preserve the original full categories list even when showing single category
    fullCategoriesList: initialCategories // Keep the full list for back navigation
  });

  // Track if we're navigating internally (to skip useEffect)
  const isInternalNavigationRef = useRef(false);

  // Track previous isOpen state to detect panel reopening
  const prevIsOpenRef = useRef(isOpen);

  // CRITICAL: Track if we've already processed initial directGridData to prevent infinite loops
  // When page refreshes, JSON.parse creates NEW object references even for same data
  // This causes useEffect to fire repeatedly because directGridData changes reference
  const hasProcessedInitialDataRef = useRef(false);

  // CRITICAL: Track the last processed category/level in refs (not state) to avoid stale closure issues
  const lastProcessedCategoryRef = useRef(null);
  const lastProcessedLevelRef = useRef(null);

  // Update state when initial props change (from chat trigger)
  useEffect(() => {
    console.log('🎨 [ArtifactPanel] Props changed:', {
      isOpen,
      patientId,
      initialLevel,
      initialCategory,
      initialDocumentId,
      hasDirectGridData: !!directGridData,
      currentLevel: state.level,
      currentSelectedCategory: state.selectedCategory,
      currentSelectedDocument: state.selectedDocument ? 'EXISTS' : 'NULL',
      isInternalNavigation: isInternalNavigationRef.current,
      hasProcessedInitialData: hasProcessedInitialDataRef.current,
      lastProcessedCategory: lastProcessedCategoryRef.current,
      lastProcessedLevel: lastProcessedLevelRef.current
    });

    // CRITICAL FIX: Prevent infinite loop on page refresh
    // When directGridData comes from localStorage (parsed JSON), it's a NEW reference each time
    // but the actual DATA hasn't changed. We only want to process it ONCE on initial mount.
    // NOTE: Do NOT use JSON.stringify for comparison - it can cause SIGBUS crash on large data!
    // Use refs instead of state to avoid stale closure issues!
    if (directGridData && hasProcessedInitialDataRef.current) {
      // Use REFS for comparison, not state (state can be stale in closure)
      const categoryUnchanged = initialCategory === lastProcessedCategoryRef.current;
      const levelUnchanged = initialLevel === lastProcessedLevelRef.current;
      if (categoryUnchanged && levelUnchanged) {
        console.log('🎨 [ArtifactPanel] SKIPPING useEffect - already processed, category/level unchanged (ref check)');
        return;
      }
    }

    // Mark that we've processed initial data and track what we processed (only when directGridData is present)
    if (directGridData && !hasProcessedInitialDataRef.current) {
      console.log('🎨 [ArtifactPanel] Marking initial data as processed');
      hasProcessedInitialDataRef.current = true;
    }

    // ALWAYS update the refs to track the latest category/level being processed
    // This prevents loops when directGridData reference changes but category/level stay same
    if (directGridData) {
      lastProcessedCategoryRef.current = initialCategory;
      lastProcessedLevelRef.current = initialLevel;
    }

    // CRITICAL FIX: Detect panel reopening (isOpen transitions from false to true)
    // When reopening, reset to categories view ONLY if no specific level/category/document is provided
    const wasClosed = prevIsOpenRef.current === false && isOpen === true;
    prevIsOpenRef.current = isOpen;

    if (wasClosed) {
      // Only reset to categories if we're opening WITHOUT specific content
      // If initialLevel, initialCategory, or initialDocumentId are provided, don't reset
      const hasSpecificContent = initialLevel !== 'categories' || initialCategory || initialDocumentId || directGridData;

      if (!hasSpecificContent) {
        console.log('🎨 [ArtifactPanel] Panel reopened without specific content - resetting to categories view');
        setState(prev => ({
          ...prev,
          level: 'categories',
          selectedCategory: null,
          selectedDocument: null,
          documentId: null,
          categoriesData: null  // Force fresh fetch when reopening
        }));
        return;
      } else {
        console.log('🎨 [ArtifactPanel] Panel reopened WITH specific content - not resetting to categories');
        // Fall through to handle the specific content below
      }
    }

    // CRITICAL FIX: Skip this effect if we're navigating internally (from navigateToDetail, etc.)
    // Internal navigation manages state directly, this effect is only for external triggers
    if (isInternalNavigationRef.current) {
      console.log('🎨 [ArtifactPanel] Skipping useEffect - internal navigation');
      isInternalNavigationRef.current = false; // Reset flag
      return;
    }

    // CRITICAL FIX: If initialCategory is different from current selected category, ALWAYS update
    // This ensures that asking for a different collection replaces the artifact with new data
    const categoryChanged = initialCategory && initialCategory !== state.selectedCategory;

    if (categoryChanged) {
      console.log('🎨 [ArtifactPanel] CATEGORY CHANGED from:', state.selectedCategory, 'to:', initialCategory);
      console.log('🎨 [ArtifactPanel] Will update artifact with new category data');
      // FALL THROUGH to update state with new category
    } else if ((state.level === 'document-collection' || state.level === 'grid' || state.level === 'documents') &&
      state.selectedCategory === initialCategory) {
      console.log('🎨 [ArtifactPanel] Skipping useEffect - already viewing same category:', state.selectedCategory);
      // DON'T update if viewing same category - preserve the current view
      return;
    }

    // CRITICAL FIX: If initialLevel is 'categories' (user requested medical history without specific category),
    // ALWAYS reset to categories view regardless of current state
    if (initialLevel === 'categories' && initialCategory === null) {
      console.log('🎨 [ArtifactPanel] User requested categories view - resetting to categories list');
      console.log('🎨 [ArtifactPanel] initialCategories provided:', initialCategories ? initialCategories.length : 0, 'categories');

      // CRITICAL: Only force fresh fetch if NO categories were provided in props
      // If categories were provided (from Chat message), use them instead of forcing API fetch
      setState(prev => ({
        ...prev,
        level: 'categories',
        selectedCategory: null,
        selectedDocument: null,
        documentId: null,
        categoriesData: initialCategories || null  // Use initialCategories if provided, otherwise force fetch
      }));
      return;
    }

    // CRITICAL FIX: If we already have selectedDocument in state and incoming props show detail level,
    // don't run this effect - we're already showing the document from internal navigation
    if (state.selectedDocument && initialLevel === 'detail' && state.selectedCategory === initialCategory) {
      console.log('🎨 [ArtifactPanel] Skipping useEffect - already have document from internal nav');
      return;
    }

    if (isOpen) {
      let actualLevel = initialLevel || 'categories';
      let actualDocumentId = initialDocumentId;

      setState(prev => {
        // CRITICAL FIX: Detect category change vs just navigating within category
        const categoryChanged = prev.selectedCategory !== initialCategory;

        // When category changes, ALWAYS replace all old data with new data
        // When category stays same, preserve current selectedDocument (don't clear it)
        const newState = {
          level: actualLevel,
          selectedCategory: initialCategory,
          selectedDocument: (categoryChanged ? null : prev.selectedDocument) || (directGridData?.document || null),
          documentId: actualDocumentId || (categoryChanged ? null : prev.documentId),
          // CRITICAL: If category changed, clear gridData so DocumentListView fetches fresh
          // Only use directGridData if provided AND category hasn't changed
          gridData: categoryChanged ? null : directGridData,
          categoriesData: initialCategories,
          hasMultipleCategoriesRoot: initialCategories && initialCategories.length > 1,
          // CRITICAL: Preserve the FULL categories list when navigating between categories
          // If we already have a full list AND incoming categories are just 1 (single category response),
          // keep the full list for back navigation
          fullCategoriesList: (prev.fullCategoriesList &&
            prev.fullCategoriesList.length > 1 &&
            (!initialCategories || initialCategories.length === 1))
            ? prev.fullCategoriesList  // Keep full list
            : (initialCategories || prev.fullCategoriesList)  // Use new if available
        };
        console.log('🎨 [ArtifactPanel] Setting state to:', {
          ...newState,
          selectedDocument: newState.selectedDocument ? '(has document)' : 'NULL',
          categoryChanged,
          fullCategoriesListLength: newState.fullCategoriesList?.length,
          gridDataCleared: categoryChanged
        });
        return newState;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patientId, initialLevel, initialCategory, initialDocumentId, directGridData, initialCategories]);

  // Navigation functions
  const navigateToCategories = () => {
    setState(prev => {
      console.log('🔙 [ArtifactPanel] navigateToCategories - current categoriesData:', prev.categoriesData?.length, 'categories');
      console.log('🔙 [ArtifactPanel] navigateToCategories - fullCategoriesList:', prev.fullCategoriesList?.length, 'categories');

      // CRITICAL: Use the full categories list if available (from initial categories view)
      // Otherwise use the current categoriesData
      // This ensures back navigation returns to full list when coming from categories
      const categoriesToShow = prev.fullCategoriesList && prev.fullCategoriesList.length > 1
        ? prev.fullCategoriesList  // Use full list from categories view
        : prev.categoriesData;     // Fall back to current data

      console.log('🔙 [ArtifactPanel] Will show:', categoriesToShow?.length, 'categories');

      return {
        ...prev,
        level: 'categories',
        selectedCategory: null,
        selectedDocument: null,
        documentId: null,
        categoriesData: categoriesToShow  // Use full list if available, otherwise current
      };
    });
    // Update localStorage directly without calling onNavigate
    localStorage.setItem('artifactLevel', 'categories');
    localStorage.removeItem('artifactCategory');
    localStorage.removeItem('artifactDocumentId');
    console.log('[ArtifactPanel] Navigated to categories, updated localStorage directly');
  };

  // Collections that should show aggregate document view (single formatted document)
  const DOCUMENT_VIEW_COLLECTIONS = [
    // Patient information
    'patient_details',
    'patient_education_records',
    'patient_instructions',  // ← Patient instructions and action items (discharge instructions, follow-up tasks)
    'patient_provider',  // ← Patient's assigned healthcare provider (renamed from providers)
    'drug_gene_interaction_report',  // ← Pharmacogenomic reports (drug-gene interactions, CYP450, PGx dosing)
    'cyp450_panel_results',  // ← CYP450 panel results (genotypes, phenotypes, activity scores, drug interactions)
    'medication_safety_alerts',  // ← Medication safety alerts (FDA warnings, drug interactions, contraindications)
    'detailed_family_pedigree',  // ← Detailed family pedigree (three-generation pedigree, inheritance patterns)
    'acmg_guidelines_reference',  // ← ACMG guidelines reference (variant classification, pathogenicity criteria)
    'variant_interpretation_guidelines',  // ← Variant interpretation guidelines (VUS, pathogenic, benign criteria)
    'prior_authorization_status',  // ← Prior authorization status (insurance approval, medication authorization)
    'pharmacogenomic_testing',  // ← Pharmacogenomic testing (PGx results, gene-drug interactions, metabolizer status)
    'medication_dosing_recommendation',  // ← Medication dosing recommendation (PGx-guided dosing, therapeutic adjustments)
    'progress_notes',  // ← Progress notes (clinical notes, nursing notes, daily progress)
    'cardiology_admission_notes',  // ← Cardiology admission notes (chest pain, EKG, echo, biomarkers)
    'inheritance_pattern_details',  // ← Genetic inheritance patterns (dominant, recessive, X-linked, etc.)
    'children_specific_risk',  // ← Children-specific risk assessments (pediatric growth, screening, conditions)
    'psychosocial_support_services',  // ← Psychosocial support services (PHQ-9, GAD-7, therapy, referrals)
    'medication_therapy_management',  // ← MTM sessions, drug therapy problems, action plans, cost savings
    'comprehensive_medication_review',  // ← CMR: adherence, drug safety, dosing, therapy problems, cost
    'pharmacist_consultation',  // ← Pharmacist MTM: interventions, cost savings, immunization, adherence
    'rehabilitation_goals',  // ← Rehabilitation goals (PT, OT, therapy milestones, progress tracking)
    'rehabilitation_progress_notes',  // ← Rehabilitation progress notes (FIM, Barthel, Rankin, gait, swallowing, speech therapy, assistive devices)
    // AI-generated collections
    'clinical_decision_support',
    'intelligent_recommendations',
    'recommendations',
    'trending_analysis',
    'trend_analysis',  // ← Trend analysis for lab values, vitals, and clinical trends
    'patient_specific_care_plan',
    'medications',  // ← Patient medications list
    'mental_health_resources',  // ← Mental health resources (counseling, support groups, therapy options)
    'mental_status_exam',  // ← Mental status exam (appearance, behavior, mood, affect, thought process)
    'athlete_specific_data',  // ← Athlete specific data (sport profile, previous injuries, team support)
    'medication_optimization',
    'follow_up_intelligence',
    'follow_up_appointments',  // ← Follow-up appointment scheduling
    'follow_ups',  // ← Follow-up recommendations from document analysis
    'patient_education_context',
    'quality_assurance',  // ← Quality assurance (peer review, outside consultation, tumor board)
    'lymph_node_cytomorphology',  // ← Lymph node cytomorphology (cell morphology, Ki-67, proliferation)
    'staging_summary',  // ← Staging summary (overall stage, IPI score, prognostic implications, treatment approach)
    'immunization_status',  // ← Immunization status (vaccines, boosters, vaccination records)
    'immunization_record',  // ← Immunization record (vaccination history, immunization dates, lot numbers)
    'fertility_preservation',  // ← Fertility preservation (ovarian reserve, oocyte/embryo cryopreservation, sperm preservation)
    'past_medical_history',  // ← Past medical history (prior conditions, surgeries, hospitalizations)
    'plastic_surgery_assessment',  // ← Plastic surgery assessment (reconstructive, cosmetic procedures)
    'quality_metrics',
    'colonoscopy_reports',  // ← Colonoscopy reports (GI endoscopy, Mayo score, extent, findings, pathology, assessment, plan, recommendations)
    'extraintestinal_manifestations',  // ← Extraintestinal manifestations (IBD, articular, dermatologic, ocular, hepatobiliary, renal, pulmonary, hematologic)
    'ibd_surgical_planning',  // ← IBD surgical planning (surgery type, urgency, pouch option, indications, risks, patient preference, staging)
    'bone_health',  // ← Bone health (DEXA scan, bone protection therapy, risk factors, fractures, recommendations)
    'compression_therapy',  // ← Compression therapy (garment type, vascular assessment, edema, lymphedema, adverse reactions)
    'closure_technique',  // ← Closure technique (procedure name, closure layer, suture type/material/size, port site closure, skin closure)
    'cancer_related_side_effects',  // ← Cancer related side effects (lymphedema, neuropathy, fatigue, cognitive changes, sexual dysfunction)
    'bone_scan_reports',  // ← Bone scan reports (nuclear medicine bone scan, skeletal scintigraphy, metabolic bone disease, fractures)
    'pet_scan_reports',  // ← PET scan reports (PET/CT, SUV values, staging, lymph nodes, metastatic sites, radiopharmaceutical)
    'thoracic_surgery_assessment',  // ← Thoracic surgery assessment (lung resection, lobectomy, VATS, PFTs, tumor staging, adjuvant therapy)
    'cystoscopy_reports',  // ← Cystoscopy reports (bladder assessment, urethral findings, biopsy, ureteric orifices)
    'urodynamic_studies',  // ← Urodynamic studies (filling/voiding cystometry, flow rates, detrusor assessment, incontinence)
    'urology_consultations',  // ← Urology consultations (chief complaint, prostate, renal, stones, urodynamics, cystoscopy, sexual function)
    'nuclear_medicine_assessment',  // ← Nuclear medicine assessment (PET scan, bone scan, thyroid scan, parathyroid SPECT, cardiac perfusion with LVEF/ischemia/TID bar charts)
    'nuclear_medicine_studies',  // ← Nuclear medicine studies (thyroid scan, uptake, radiopharmaceutical, nodule analysis)
    'colorectal_surgery_assessment',  // ← Colorectal surgery assessment (colonoscopy, anorectal manometry, defecography, stoma assessment, oncologic markers)
    'nutritional_assessment',  // ← Nutritional assessment (diet type, weight status, dietary restrictions, supplements, feeding difficulties)
    'psc_management',  // ← PSC Management (Primary Sclerosing Cholangitis - ursodeoxycholic acid, MRCP, strictures, hepatology management)
    'continuous_infusions',  // ← Continuous Infusions (ICU/Critical Care - vasopressors, sedation, insulin drip, vital signs, interventions, response)
    'sepsis_management',  // ← Sepsis Management (severity, qSOFA/SOFA, cultures, antibiotics, vasopressors, organ dysfunction, bundle compliance)
    'concussion_assessment',  // ← Concussion Assessment (GCS, SCAT5, cognitive testing, balance, symptoms, return to play)
    'ems_run_reports',  // ← EMS Run Reports (vital signs, GCS, mechanism of injury, airway, transport, disposition)
    'glasgow_coma_scale',  // ← Glasgow Coma Scale (Neurological Assessment - GCS score, eye opening, verbal response, motor response, clinical status, interventions)
    'care_gaps',
    'care_coordination',  // ← Care coordination records (multidisciplinary planning, care transitions, team communication)
    'preventive_care',  // ← Preventive care screenings and immunizations
    'health_maintenance',  // ← Health maintenance records (preventive care, screening schedules, wellness visits)
    'home_health_notes',  // ← Home health notes (home visits, environmental assessments, home care)
    'environmental_exposures',  // ← Environmental exposures (housing, air quality, occupational, smoking)
    'clinical_scores',
    'consultation_notes',
    'interval_history',  // ← Interval history (changes since last visit, therapy, exercise, sleep, mood, findings)
    'soap_notes',  // ← SOAP notes (subjective, objective, assessment, plan, coding)
    'telemedicine_encounters',  // ← Telemedicine encounters (vitals, medications, allergies, orders, referrals)
    'weekly_virtual_check_ins',  // ← Weekly virtual check-ins (symptom monitoring, assessment, recommendations)
    'immune_function_tests',  // Immune function tests (T cells, B cells, immunoglobulins, complement, NK cells)
    'diagnoses',
    'diagnostic_studies',  // ← Diagnostic studies (vitamin B12, thyroid, brain MRI, orthostatic vitals, DaTscan)
    'dementia_assessment',  // ← Dementia assessment (type, CDR score, functional status, cognitive enhancers, safety, advance directives)
    'dementia_education',  // ← Dementia education (scores, education topics, behavioral symptoms, communication strategies)
    'elder_abuse_screening',  // ← Elder abuse screening (abuse indicators, clinical observations, perpetrator assessment, reporting)
    'blood_glucose_logs',  // ← Blood glucose logs (glucose values, insulin dosing, meal timing, notes)
    'diabetes_educator',  // ← Diabetes educator (session overview, glycemic control, insulin regimen, nutrition, complications)
    'diagnostic_impression',  // ← Diagnostic impression (primary diagnosis, comorbidities, clinical findings)
    'document_metadata',  // ← Document metadata (document type, specialty service, clinical scores)
    'guideline_compliance',
    'history_present_illness',
    'outcomes_prediction',
    // Medical record collections (typically 1 comprehensive document)
    'anesthesia_records',
    'anesthesia_complications',  // ← Anesthesia complications (complication type, severity, interventions, medications, outcomes)
    'anesthesia_consent',  // ← Anesthesia consent (risks disclosed, alternatives, airway assessment, regional technique, consent details)
    'anesthesiology_assessment',  // ← Anesthesiology assessment (ASA class, airway, STOP-BANG, RCRI, Apfel, pain management)
    'cardiology_admission_notes',
    'cardiology_consultations',  // ← Cardiology consultations (referrals, specialist evaluations, recommendations)
    'cardiology_followup_reports',  // ← Cardiology followup reports (NYHA class, EF, device checks, ECG, medications, next follow-up)
    'cardiovascular_risk_reduction',  // ← Cardiovascular risk reduction (risk factors, assessment, plan, recommendations)
    'cardiovascular_risk_screening',  // ← Cardiovascular risk screening (Framingham, ASCVD scores, lipid panel, risk factors)
    'stress_test_reports',  // ← Stress test reports (6-minute walk test, cardiac stress tests, functional assessments)
    'hospital_discharge_summaries',
    'hospital_course',  // ← Hospital course timeline from admission to discharge
    'discharge_summaries',  // ← Added for getDischargeSummaries() function
    'prescriptions',  // ← Prescriptions list with PrescriptionsDocument template
    'lab_orders',  // ← Laboratory orders (pending tests, ordered tests)
    'lab_results',  // ← Lab results (CBC, metabolic panels, lipids, urinalysis, etc.)
    'endocrine_lab_results',  // ← Endocrine lab results (thyroid, diabetes markers, adrenal, hormones, vitamin D)
    'diabetes_supplies',  // ← Diabetes supplies (glucometer, CGM, insulin pump supplies, DME)
    'basal_rate_adjustments',  // ← Basal rate adjustments (insulin pump basal rates, time blocks)
    'bolus_adjustments',  // ← Bolus adjustments (insulin:carb ratios, meal boluses)
    'imaging_reports',
    'radiology_reports',  // ← Radiology reports (X-ray, CT, MRI, ultrasound interpretations)
    'mammography_reports',  // ← Mammography reports (breast imaging, BI-RADS assessment, screening/diagnostic mammograms)
    'interventional_radiology_notes',  // ← Interventional radiology notes (procedures, biopsies, devices, imaging guidance, outcomes)
    'radiology_findings',  // ← Radiology findings (modality, technique, contrast, anatomic findings, RADS scores - BI-RADS, TI-RADS, PI-RADS)
    'neurological_findings',  // ← Neurological findings (brain, spinal cord, peripheral nerve, motor, sensory, reflex findings)
    'surgical_history',  // ← Surgical history (past procedures, surgeons, outcomes, complications)
    'post_operative_reports',  // ← Post-operative reports (surgery date, procedure, complications, PACU, vitals, recovery)
    'mri_reports',  // ← MRI reports (brain, spine, abdomen imaging with sequences, findings, measurements, impression)
    'multiple_sclerosis_assessment',  // ← Multiple sclerosis assessment (MS type, EDSS, MRI findings, McDonald criteria, DMT, relapses)
    'preoperative_preparation',  // ← Preoperative preparation (procedure, bowel/skin prep, antibiotics, DVT prophylaxis, NPO status, testing, consent, site marking)
    'imaging_orders',  // ← Pending imaging orders (ordered/in_progress)
    'pulmonary_imaging',  // ← Pulmonary imaging (chest X-ray, CT, V/Q scan, pulmonary angiography)
    'medical_images',  // ← Medical images (encrypted image storage with AI analysis)
    'additional_data',  // ← Additional data (flexible overflow/specialized data)
    'intraoperative_monitoring',  // ← Intraoperative monitoring (SSEP, MEP, EEG, EMG)
    'treatment_courses',
    'smoking_cessation_program',  // ← Smoking cessation programs (counseling, medications, recommendations)
    // Abnormal Results
    'abnormal_results',  // ← Abnormal results (lab findings, urgency, clinical indication, recommendations, follow-up)
    // Allergies
    'allergies',  // ← Allergies list
    'allergy_assessments',  // ← Comprehensive allergy assessments with test results and recommendations
    'allergy_assessment',  // ← Single allergy assessment
    'allergy_skin_testing',  // ← Allergy skin testing results
    'ent_assessment',  // ← ENT assessment (audiometry, nasopharyngolaryngoscopy, sinus assessment, hearing tests)
    'specific_ige_tests',  // ← Specific IgE blood test results for allergen antibodies
    'component_allergen_testing',  // ← Component allergen testing results
    'asthma_assessments',  // ← Comprehensive asthma assessments with severity, control, and management
    'asthma_action_plan',  // ← Asthma action plan (green/yellow/red zone medications)
    'developmental_assessments',  // ← Developmental assessments (pediatric milestones, gross/fine motor, language, cognitive)
    'early_childhood_development',  // ← Early childhood development (speech, social, self-care, recommendations)
    'developmental_milestones',  // ← Developmental milestones (achieved/pending status per domain)
    'pediatric_growth_charts',  // ← Pediatric growth charts (height, weight, BMI percentiles)
    'growth_parameters',  // ← Growth parameters (height, weight, head circumference, BMI with percentiles, pubertal stage)
    'growth_ultrasound_schedule',  // Growth ultrasound schedule (frequency, starting week, specific weeks, purpose, findings)
    'pediatric_screening',  // ← Pediatric screening (vision, hearing, behavioral, developmental, dental, TB, lead, cholesterol)
    'pediatric_vaccination_records',  // ← Pediatric vaccination records (vaccine, manufacturer, lot, site, dose, reactions)
    'pediatric_visits',  // ← Pediatric well-child visits (milestones, immunizations, growth, guidance)
    'well_child_examinations',  // ← Well child examinations (growth percentiles, developmental screening, immunizations, guidance)
    'well_child_summary',  // ← Well child summary (visit info, growth percentiles, vaccines, milestones, screenings, nutrition, safety, concerns)
    'school_performance',  // ← School performance (academic, behavioral, social, strengths, concerns, special education)
    'school_health_forms',  // ← School health forms (immunizations, allergies, medications, screenings, emergency plans)
    'birth_history',  // ← Birth history (gestational age, delivery type, birth weight, APGAR scores, NICU stay, complications)
    'behavioral_assessment',  // ← Behavioral assessment (PSC-17, temperament, social skills, tantrums, ADHD/anxiety/autism screening)
    // Gastroenterology
    'gastroenterology_consultations',  // ← Gastroenterology consultations (GI specialist, IBD, colonoscopy, endoscopy, GI symptoms)
    'ibd_consultation_details',  // ← IBD consultation details (Mayo score, drug monitoring, symptom timeline, care team)
    'ibd_assessment',  // ← IBD assessment (disease type, extent, behavior, current flare, medical history, findings, assessment, plan)
    'disease_activity_scores',  // ← Disease activity scores (Mayo Score, Harvey-Bradshaw, CDAI, SCCAI, PUCAI)
    'inflammatory_bowel_reports',  // ← Inflammatory bowel reports (Crohn's, UC, IBD management, flares, medications)
    'insurance_forms',  // ← Insurance forms (coverage analysis, optimization recommendations, open enrollment)
    'care_coordination_notes',  // ← Care coordination notes (social work, case management, referrals, barriers, SDOH)
    'rheumatologic_treatment',  // ← Rheumatologic treatment (DMARDs, biologics, corticosteroids, NSAIDs, adjunct therapies)
    'endoscopy_findings',  // ← Endoscopy findings (procedure type, extent, Mayo score, Rutgeerts, biopsies, complications, assessment)
    'infusion_therapy',  // ← Infusion therapy (biologic infusions, IV medications, chemotherapy, dosing, scheduling)
    'medication_changes_dose',  // ← Medication changes & dose (dose adjustments, medication modifications, dosage changes)
    'medication_changes_discontinued',  // ← Medication changes discontinued (adverse reactions, contraindications, drug interactions)
    'medication_changes_new',  // ← Medication changes new (new medications, prescriptions, therapeutic class, safety screening)
    'blood_disorder_reports',             // ← Blood disorder reports (anemia, thrombocytopenia, coagulopathy)
    'social_support',                     // ← Social support assessment (caregiver, living arrangement, resources)
    'mayo_score',  // ← Mayo Score (IBD disease activity score with 4 components)
    'symptom_progression_timeline',  // ← Symptom Progression Timeline (weekly symptom progression tracking)
    'infliximab_drug_monitoring',  // ← Infliximab Drug Monitoring (trough level, therapeutic range, antibodies, interpretation)
    'fecal_calprotectin',  // ← Fecal Calprotectin (IBD inflammation biomarker - value, interpretation)
    'rescue_therapy_options',  // ← Rescue Therapy Options (second-line therapies if primary treatment fails)
    // Risk assessments
    'gi_risk_assessment',  // ← Updated: comprehensive 7-category GI risk assessment (was: gi_bleeding_risk_assessment)
    'risk_factors',  // ← General risk factors by category and severity
    // Medication Reconciliation
    'medication_reconciliation',  // ← Medication reconciliation (medications added, discontinued, continued, changed, drug interactions)
    // Referrals
    'referrals',  // ← Medical specialty referrals
    'referrals_placed',  // ← Referrals placed to specialists (pending, scheduled, completed)
    'follow_up_enhanced',  // ← Enhanced follow-up (chief complaint, vitals, medications, treatment response, tests, red flags, referrals)
    // Medical History
    'medical_history',  // ← Comprehensive medical, surgical, family, and social history
    // Vital Signs
    'vital_signs',  // ← Vital signs with medical color coding
    'vital_signs_table',  // ← Vital signs table (structured BP, HR, RR, temp, SpO2)
    'vital_signs_logs',  // ← Vital signs logs (provider, BP, cardiac, respiratory, temperature, pain/glucose, anthropometrics)
    // Weight Measurements
    'weight_measurements',  // ← Weight measurements (weight tracking, BMI, weight change)
    // Weight Monitoring
    'weight_monitoring',  // ← Weight monitoring (current/previous weight, BMI, fluid status, cardiac markers, dietary restrictions)
    // Blood Pressure Readings
    'blood_pressure_readings',  // ← Blood pressure readings (BP monitoring, hypertension tracking)
    // Kidney Function Reports
    'kidney_function_reports',  // ← Kidney function reports (eGFR, creatinine, UACR, CKD staging, albuminuria)
    // Acute Kidney Injury
    'acute_kidney_injury',  // ← Acute kidney injury (AKI stage, creatinine, urine output, etiology, precipitants, dialysis, recovery)
    // Nutritional Support
    'nutritional_support',  // ← Nutritional support (enteral, parenteral, TPN, feeding plan, ICU nutrition)
    // Nutrition Support Consultation
    'nutrition_support_consultation',  // ← Nutrition support consultation (BMI, weight loss, malnutrition, enteral, parenteral, micronutrient deficiencies)
    // Arthritis Assessments
    'arthritis_assessments',  // ← Arthritis assessments (rheumatoid, psoriatic, osteoarthritis, inflammatory markers, serology)
    // Autoimmune Panels
    'autoimmune_panels',  // ← Autoimmune panels (ANA, anti-CCP, RF, ds-DNA, ANCA, complement, ENA panel, antiphospholipid)
    'autoimmune_evaluations',  // ← Autoimmune evaluations (suspected condition, serology, organ involvement, disease activity)
    'connective_tissue_disease_assessment',  // ← CTD assessment (classification criteria, organ involvement, disease activity)
    'lupus_assessment',  // ← Lupus assessment (SLEDAI, ACR/EULAR criteria, organ involvement, serositis)
    'provider_info',  // ← Provider info (credentials, licensing, certifications, hospital affiliations)
    // Rheumatology Consultations
    'rheumatology_consultations',  // ← Rheumatology consultations (referrals, joint specialist, arthritis consult, autoimmune evaluation)
    'gout_assessment',  // ← Gout assessment (uric acid, joint aspirate, tophi, DECT, flare frequency, renal involvement)
    'rheumatologic_assessment',  // ← Rheumatologic assessment (joint involvement, morning stiffness, systemic symptoms)
    'rheumatologic_monitoring',  // ← Rheumatologic monitoring (disease activity, medication monitoring, immunization, screening)
    'spondyloarthritis_assessment',  // ← Spondyloarthritis assessment (BASDAI, BASFI, ASDAS, HLA-B27, sacroiliitis, spinal mobility)
    // Dermatology Consultations
    'dermatology_consultations',  // ← Dermatology consultations (skin specialist, skin evaluation, derm referral, skin conditions)
    // Dermatology Procedure Notes
    'dermatology_procedure_notes',  // ← Dermatology procedure notes (skin biopsy, excisional biopsy, punch biopsy, skin surgery)
    // Dermatology Assessment
    'dermatology_assessment',  // ← Dermatology assessment (skin lesions, PASI, SCORAD, DLQI, phototherapy, dermoscopy, melanoma surveillance)
    // Skin Biopsy Reports
    'skin_biopsy_reports',  // ← Skin biopsy reports (Breslow thickness, Clark level, melanoma staging, histopathology)
    // Dental Examination Reports
    'dental_examination_reports',  // ← Dental examination reports (oral exam, TMJ, dentition, wisdom teeth, periodontal)
    // Oral Surgery Reports
    'oral_surgery_reports',  // ← Oral surgery reports (wisdom teeth extraction, impaction, maxillofacial surgery, pericoronitis)
    // TMJ Assessment
    'tmj_assessment',  // ← TMJ assessment (temporomandibular joint, jaw pain, disc displacement, range of motion, occlusion)
    // Jaw Reconstruction
    'jaw_reconstruction',  // ← Jaw reconstruction (mandibular reconstruction, maxillary reconstruction, free flap, fibula flap, osteotomy)
    // Orthognathic Surgery Evaluation
    'orthognathic_surgery_evaluation',  // ← Orthognathic surgery evaluation (cephalometric analysis, skeletal classification, Le Fort, BSSO, surgical planning)
    // Dental Implant Surgery
    'dental_implant_surgery',  // ← Dental implant surgery (implant placement, osseointegration, abutment, bone grafting, sinus lift)
    // Orthopedic Operative Reports
    'orthopedic_operative_reports',  // ← Orthopedic operative reports (ACL reconstruction, knee surgery, arthroscopy, ligament repair, meniscus)
    // Orthopedic Imaging
    'orthopedic_imaging',  // ← Orthopedic imaging (MRI, X-ray, CT, bone contusions, effusion, musculoskeletal imaging)
    // Orthopedic Assessment
    'orthopedic_assessment',  // ← Orthopedic assessment (neurovascular status, fractures, dislocations, compartment syndrome)
    'orthopedic_assessments',  // ← Orthopedic assessments (plural form)
    // Orthopedic Procedures
    'orthopedic_procedures',  // ← Orthopedic procedures (procedure, technique, anesthesia, immobilization, post-procedure imaging)
    // Ligament Reconstruction
    'ligament_reconstruction',  // ← Ligament reconstruction (ACL/PCL/MCL/LCL reconstruction, graft, tunnel placement, fixation)
    // Meniscus Repair
    'meniscus_repair',  // ← Meniscus repair (meniscectomy, partial meniscectomy, tear type, location, zone, repair technique)
    // Neurovascular Exam
    'neurovascular_exam',  // ← Neurovascular exam (sensory, motor, pulses, capillary refill, neurological assessment)
    // Return to Sport
    'return_to_sport',  // ← Return to sport (sport, level, timeline, clearance criteria, functional tests, assessment)
    // Tourniquet Data
    'tourniquet_data',  // ← Tourniquet data (pressure, duration, location, surgical tourniquet records)
    // DEXA Scan Reports
    'dexa_scan_reports',  // ← DEXA scan reports (bone density, T-score, osteoporosis, osteopenia, FRAX risk)
    // Nephrology Consultation Details
    'nephrology_consultation_details',  // ← Nephrology consultation details (dialysis risk, ESKD, CKD management)
    'nephrology_consultations',  // ← Nephrology consultations (CKD, kidney disease progression, dialysis planning)
    // Kidney Disease Progression Timeline
    'kidney_disease_progression_timeline',  // ← Kidney disease progression timeline (eGFR decline, UACR, CKD staging over time)
    // Estimated Time to Dialysis
    'estimated_time_to_dialysis',  // ← Estimated time to dialysis (ESRD progression, dialysis planning, eGFR trajectory)
    // Education Initiated
    'education_initiated',  // ← Education initiated (dialysis education, patient education, renal education class)
    // Access Planning
    'access_planning',  // ← Access planning (vascular access, AV fistula, AV graft, HD catheter, peritoneal catheter)
    // Dialysis Planning
    'dialysis_planning',  // ← Dialysis planning (modality preference, access status, education, timeline, home assessment)
    // Mineral Bone Disease
    'mineral_bone_disease',  // ← Mineral bone disease (PTH, calcium, phosphorus, vitamin D, bone density, vascular calcification, CKD-MBD)
    // Renal Anemia
    'renal_anemia',  // ← Renal anemia (hemoglobin, iron studies, ESA therapy, iron therapy, transfusion history)
    // Fluid Electrolyte Management
    'fluid_electrolyte_management',  // ← Fluid electrolyte management (volume status, blood pressure, electrolytes, acidosis, hyperkalemia, diuretics)
    'fluid_intake',  // ← Fluid intake records (IV, enteral, oral, blood products, totals)
    'fluid_output',  // ← Fluid output records (urine, drains, emesis, stool, insensible loss, total)
    'ventilator_weaning_protocol',  // ← Ventilator weaning protocol (SBT, respiratory mechanics, cuff leak, RASS, extubation outcome)
    'blood_glucose_monitoring',  // ← Blood glucose monitoring (method, frequency, glucose metrics, patterns, adjustments)
    'care_team',  // ← Care team records (team members, specialties, roles, coordination goals)
    'autoantibody_profile',  // ← Autoantibody profile (ANA, core antibodies, antiphospholipid, ANCA, findings, assessment)
    'syphilis_treatment_follow_up',  // ← Syphilis treatment follow-up (staging, serology, neurosyphilis/CSF, response monitoring)
    'varicose_vein_treatment',  // ← Varicose vein treatment (duplex/CEAP, ablation, sclerotherapy, follow-up)
    'heart_transplant_follow_up',  // ← Heart transplant follow-up (rejection surveillance, graft function, immunosuppression, CAV)
    'kidney_transplant_follow_up',  // ← Kidney transplant follow-up (graft function, immunosuppression, Banff/IFTA, viral surveillance)
    'foot_reconstruction',  // ← Foot reconstruction (wound classification, perfusion, flap/vessels, Charcot, outcomes)
    'pulmonary_rehabilitation',  // ← Pulmonary rehabilitation (program, PFTs, exercise capacity, prescription, outcomes)
    'medication_action_plan',  // ← Medication action plan (reconciliation, risk scores, interactions, deprescribing)
    'polypharmacy',  // ← Polypharmacy (medication burden, Beers/STOPP-START, interactions, deprescribing)
    'cesarean_threshold',  // ← Cesarean threshold assessment (maternal/fetal factors, labor progress, indications)
    'diabetes_educator_training',  // ← Diabetes education & self-management (glycemic control, insulin, complications)
    'height_measurements',  // ← Height measurements (anthropometry, surrogate measures, pediatric growth, BMI)
    'point_of_care_ultrasound_heart_rate',  // ← POCUS heart rate (measurement, findings, results, recommendations)
    'glucose_testing_weeks',  // ← Glucose tolerance test (1-hr/3-hr tests, results, recommendations)
    'social_functional_assessment',  // ← Social & functional assessment (living situation, support, social engagement)
    'patient_emotional_response',  // ← Patient emotional response (emotional state, concerns, support needed)
    'support_group_referral',  // ← Support group referral (referral, group type, clinical, recommendations)
    'partner_involvement',  // ← Partner involvement assessment (caregiver burden, roles, coping, scores)
    'admission_decisions',  // ← Admission decision (recommendation, patient preference, alternative plan)
    'post_op_testing',  // ← Post-operative testing — orthopedic knee (ligament exam, stress/ROM, POD1)
    'postop_testing',  // ← Post-operative testing — general (pain, wound, labs, systems review, recovery)
    'bone_marrow_transplant_evaluation',  // ← BMT evaluation (HLA matching, risk scores, organ function, conditioning)
    'bone_marrow_transplant_follow_up',  // ← BMT follow-up (engraftment, chimerism, GVHD, immune reconstitution)
    'pancreas_transplant_follow_up',  // ← Pancreas transplant follow-up (graft function, vascular, rejection, immunosuppression)
    'cytogenetics',  // ← Cytogenetics (karyotype, translocations, interpretation, results)
    'blood_products',  // ← Blood products / transfusion (product, crossmatch, pre/post-transfusion labs)
    'pre_operative_preparation',  // ← Pre-operative preparation (NPO, IV access, antibiotics, consent, anesthesia)
    'amniotic_fluid_index_current',  // ← Amniotic fluid index (AFI, quadrants, MVP, interpretation)
    'fetal_echo_results',  // ← Fetal echocardiography results (views, valves, function, shunts)
    'annual_physical_examination',  // ← Annual physical examination (vitals, anthropometrics, systems exam, preventive)
    'caregiver_support_groups',  // ← Caregiver support groups (burden scores, care demands, coping, education)
    'family_meeting_decisions',  // ← Family meeting decisions (attendees, advance directives, goals of care, referrals)
    'frailty_assessment',  // ← Frailty assessment (frailty phenotype, scales, sarcopenia)
    'geriatric_nutritional_assessment',  // ← Geriatric nutritional assessment (MNA, labs, diet, supplementation)
    'chronic_disease_goals',  // ← Chronic disease goals (targets, progress, timeline, interventions)
    'continuous_glucose_monitor_discussion',  // ← CGM discussion (diabetes context, monitoring, device recommendation)
    'hypoglycemia_protocol',  // ← Hypoglycemia protocol (presentation, symptoms, treatment, response)
    'hormone_therapy_records',  // ← Hormone therapy records (regimen, baseline hormones, monitoring, risk)
    'urology_assessment',  // ← Urology assessment (diagnostics, renal/stones, clinical)
    'neuropsych_testing',  // ← Neuropsychological testing (cognitive/executive/memory scores)
    'wellness_visit_documentation',  // ← Wellness visit (vitals, immunizations, health maintenance, screening scores)
    'continuous_glucose_monitor',  // ← CGM discussion (offered/accepted, device, clinical) — distinct from cgm_data
    'vital_signs_monitoring',  // ← Vital signs monitoring (BP/HR/RR/temp/SpO2/neuro numerics) — distinct from hourly_vital_signs
    'obstetric_ultrasound_reports',  // ← OB ultrasound reports (biometry, fetal anatomy, impression)
    'doctors_medications_recommendations_optimizations',  // ← Medication optimization (current therapy, recommendation, safety, monitoring)
    'allergies_assessments',  // ← Allergies assessment (allergen, reaction, severity, status, notes)
    'occupational_exposure_records',  // ← Occupational exposure (event, source/agent, PPE, prophylaxis, reporting)
    'fmla_documentation_note',  // ← FMLA note (functional capacity, work restrictions, leave, diagnosis)
    'workers_comp_evaluations',  // ← Workers comp eval (injury, exam findings, impairment, opinions)
    'emergency_disposition',  // ← ED disposition (admission/transfer, timing, discharge follow-up)
    'procedure_requests',  // ← Procedure requests (request, requester/performer, scheduling, clinical)
    'port_placement',  // ← Surgical port placement (procedure, port config, closure/complications)
    'burn_assessment',  // ← Burn assessment (TBSA, depth, locations, inhalation injury, fluid resuscitation, escharotomy, wound management)
    'burn_fluid_resuscitation',  // ← Burn fluid resuscitation (Parkland/Brooke formulas, urine output targets, hemodynamics, perfusion markers, resuscitation status)
    'burn_wound_care',  // ← Burn wound care (TBSA, severity scoring, wound assessment, grafting, escharotomy, nutritional support, scar management)
    'burn_rehabilitation',  // ← Burn rehabilitation (TBSA, burn depth, scar assessment, ROM deficits, contractures, pressure garments, pain scores, functional outcomes)
    'cam_icu',  // ← CAM-ICU assessment (delirium screening, sedation vacation, clinical status, vital signs, interventions, response, plan, recommendations)
    'chiropractic_consultation',  // ← Chiropractic consultation (chief complaint, subluxation, ROM, orthopedic tests, myotome, palpation, postural analysis, adjustment)
    'spinal_manipulation_record',  // ← Spinal manipulation record (segments, technique, thrust, positioning, force, subluxation, ROM, pain scores)
    'chiropractic_x_ray_review',  // ← Chiropractic x-ray review (chief complaint, region, views, curvature, disc narrowing, osteophytes, facet, DDD)
    'chiropractic_treatment_plan',  // ← Chiropractic treatment plan (chief complaint, subluxation, ROM, muscle strength, orthopedic tests, treatment approach, schedule, goals)
    // Renal Nutrition
    'renal_nutrition',  // ← Renal nutrition (dietary restrictions, protein/sodium/potassium/phosphorus/fluid, lifestyle modifications, recommendations)
    // Medication Renal Dosing
    'medication_renal_dosing',  // ← Medication renal dosing (adjusted medications, contraindicated medications, nephrotoxic exposures, contrast protocol)
    // Diabetic Nephropathy
    'diabetic_nephropathy',  // ← Diabetic nephropathy (albuminuria stage, retinopathy, neuropathy, glycemic control, RAAS blockade, SGLT2 inhibitor)
    // Hypertensive Nephropathy
    'hypertensive_nephropathy',  // ← Hypertensive nephropathy (target organ damage, blood pressure control, medications, assessment, plan)
    // Neurology Progress Notes
    'neurology_progress_notes',  // ← Neurology progress notes (consult date, referral reason, chief complaint, exam findings, diagnosis, treatment plan, follow-up plan, recommendations)
    // Geriatric Care Planning
    'geriatric_care_planning',  // ← Geriatric care planning (code status, advanced directives, goals of care, prognosis, palliative care, hospice, transition planning)
    // CKD Assessment
    'ckd_assessment',  // ← CKD assessment (stage, eGFR, creatinine, progression risk, etiology, findings, plan, recommendations)
    // Proteinuria Assessment
    'proteinuria_assessment',  // ← Proteinuria assessment (UACR, UPCR, protein trend, hematuria, RBC casts, urine electrophoresis)
    // Treatment Plans
    'treatment_plans',  // ← Treatment plans with procedures and goals
    // Prognosis
    'prognosis',  // ← Prognosis assessments with short/long-term outcomes, risk/protective factors, treatment response
    // Prognosis Records
    'prognosis_records',  // ← Prognosis records with diagnosis, short/long-term outlook, mortality risk
    // Prognosis Discussion
    'prognosis_discussion',  // ← Prognosis discussion (patient understanding, emotional support, family support, counseling)
    // Symptom Progression
    'symptom_progression',  // ← Symptom progression timeline with current status, findings, assessment, plan
    // Social Work
    'social_work',  // ← Social work assessment (support system, concerns, barriers, interventions)
    // Goals of Care Discussion
    'goals_of_care_discussion',  // ← Goals of care discussion (advance directives, code status, treatment preferences, prognosis)
    // Patient Care Goals
    'patient_care_goals',  // ← Patient care goals (goal description, priority, status, interventions, barriers, outcomes)
    // Monitoring Plans
    'monitoring_plans',  // ← Monitoring plans with lab, imaging, clinical assessments, and frequency
    // Clinical Scores
    'clinical_scores',  // ← Clinical scores with color-coded interpretations
    // Family Meeting Notes
    'family_meeting_notes',  // ← Family meeting notes with attendees, discussions, decisions
    // Family Medicine Assessment
    'family_medicine_assessment',  // ← Family medicine assessment (chronic disease management, preventive screening, immunizations)
    // Family Medicine Visits
    'family_medicine_visits',  // ← Family medicine visits (visit info, chief complaint, assessment, plan, medications)
    // Functional Assessments
    'functional_assessments',  // ← Functional assessments with ADL/IADL scores and items
    'psychiatric_treatment_plan', // ← Psychiatric treatment plan (diagnoses, meds, therapy, safety plan)
    'suicide_risk_assessment', // ← Suicide risk assessment (ideation, plan, risk factors, protective factors, interventions)
    'supplementation_plans', // ← Supplementation plans (supplement, dosage, condition, reasoning, findings, provider)
    'follow_up_plan', // ← Follow-up plan (interval, reason, modality, monitoring, medications, labs, imaging, referrals)
    'psychotropic_medications', // ← Psychotropic medications (current, past, allergies)
    // Lifestyle Assessments
    'lifestyle_assessments',  // ← Lifestyle assessments with diet, exercise, sleep, stress
    // Lifestyle Counseling
    'lifestyle_counseling',  // ← Lifestyle counseling (diet, exercise, weight, stress, sleep, smoking, alcohol counseling)
    // Risk Calculators
    'risk_calculators',  // ← Risk calculators (ASCVD, Framingham, FRAX, CHA2DS2-VASc, MELD)
    // Preventive Biomarkers
    'preventive_biomarkers',  // ← Preventive biomarkers (hsCRP, Vitamin D, Omega-3, ApoB, Lp(a))
    // Preventive Medicine Assessments
    'preventive_medicine_assessments',  // ← Preventive medicine assessments (screenings, interventions, goals)
    // Screening Compliance
    'screening_compliance',  // ← Screening compliance (mammography, colonoscopy, cervical, lung cancer)
    // Mental Status Exams
    'mental_status_exams',  // ← Mental status exams (psychiatric/neurological assessments)
    // Mood & Psychological Assessment
    'mood_psychological_assessment',  // ← Mood & psychological assessment (GDS, GAD, PHQ-9, sleep pattern, findings)
    // Gynecology Consultations
    'gynecology_consultations',  // ← Gynecology consultations (exam findings, diagnosis, treatment plan, recommendations)
    // Cytology Reports
    'cytology_reports',  // ← Cytology reports (Pap smear, ThinPrep, Bethesda category, cytologic findings, diagnosis)
    // Flow Cytometry Reports
    'flow_cytometry_reports',  // ← Flow cytometry reports (lymph node, bone marrow, abnormal cell populations, CD markers, immunophenotyping)
    // Flare Management
    'flare_management',  // ← Flare management (rescue therapy, escalation criteria, admission criteria, autoimmune flare protocols)
    // Obstetric History
    'obstetric_history',  // ← Obstetric history (gravida, para, G/P notation, previous pregnancies, pregnancy losses)
    // Current Pregnancy
    'current_pregnancy',  // ← Current pregnancy (gestational age, EDD, complications, high risk factors, insulin management)
    // Prenatal Screening
    'prenatal_screening',  // ← Prenatal screening (NT scan, cell-free DNA, first trimester screen, anatomy scan, fetal echo)
    // Cell-Free DNA Result
    'cell_free_dna_result',  // ← Cell-free DNA result (NIPT, trisomy risk, fetal fraction, z-scores, microdeletion screening)
    // Amniocentesis Reports
    'amniocentesis_reports',  // ← Amniocentesis reports (karyotype, chromosomal microarray, AFP, genetic diagnosis, amniotic fluid)
    'amniotic_fluid_assessment',  // ← Amniotic fluid assessment (AFI, frequency, method, findings, thresholds for polyhydramnios/oligohydramnios)
    'cervical_length_measurement',  // ← Cervical length measurement (length, funneling, os appearance, cerclage, risk)
    'perinatal_mental_health_referral',  // ← Perinatal mental health referral (EPDS/PHQ-9/GAD-7 screening, risk, referral)
    // First Trimester Bleeding
    'first_trimester_bleeding',  // ← First trimester bleeding (occurred, weeks, severity, resolved, findings, assessment, plan, followUp, notes)
    // First Trimester Screen Result
    'first_trimester_screen_result',  // ← First trimester screen (NT, PAPP-A, beta-hCG, trisomy risk, ultrasound measurements)
    // NT Scan Result
    'nt_scan_result',  // ← NT scan result (nuchal translucency, CRL, fetal heart rate, nasal bone, risk scores, PAPP-A, beta-hCG)
    // Anatomy Scan Result
    'anatomy_scan_result',  // ← Anatomy scan (fetal anatomy, placenta, amniotic fluid, abnormalities)
    'pregnancy_course',  // ← Pregnancy course (trimester data, screening, complications)
    'estimated_delivery_date',  // ← Estimated delivery date (EDD, gestational age, method, reliability)
    // Fetal Ultrasound
    'fetal_ultrasound',  // ← Fetal ultrasound (anatomy scan, growth scans, doppler studies, amniotic fluid, presentation)
    // Gestational Diabetes
    'gestational_diabetes',  // ← Gestational diabetes (GDM, OGTT results, glucose monitoring, insulin management, risk factors)
    // Glucose Monitoring Goals
    'glucose_monitoring_goals',  // ← Glucose monitoring goals (fasting targets, post-prandial targets, CGM goals, monitoring frequency)
    // Psychosocial Factors
    'psychosocial_factors',  // ← Psychosocial factors (stressors, support, coping strategies, mental health, findings, assessment, plan)
    // Fetal Surveillance
    'fetal_surveillance',  // ← Fetal surveillance (NST, BPP, kick counts, fetal heart rate, contraction stress test)
    // Umbilical Artery Doppler
    'umbilical_artery_doppler',  // ← Umbilical artery doppler (PI, RI, result, interpretation, findings, assessment, plan, notes)
    // Delivery Planning
    'delivery_planning',  // ← Delivery planning (target gestational age, delivery mode, indications, special preparations)
    // Fetal Echocardiography
    'fetal_echo',  // ← Fetal echocardiography (cardiac axis, position, cardiac rhythm, heart rate, septal integrity, valve morphology, cardiothoracic ratio)
    // Fetal Assessment
    'fetal_assessment',  // ← Fetal assessment (fetal heart rate, fundal height, fetal movement, position, presentation, estimated weight)
    // Cervical Assessment
    'cervical_assessment',  // ← Cervical assessment (cervical length, dilation, effacement, consistency, position, Bishop score, cerclage)
    // Prenatal Education
    'prenatal_education',  // ← Prenatal education (topics discussed, childbirth classes, breastfeeding education, warning signs reviewed)
    // Prenatal Visits
    'prenatal_visits',  // ← Prenatal visits (gestational age, vitals, fetal assessment, lab results, plan)
    // Contraction Monitoring
    'contraction_monitoring',  // ← Contraction monitoring (contraction frequency, duration, intensity, cervical change, findings, assessment, tocolytics)
    // Labor & Delivery Records
    'labor_delivery_records',  // ← Labor & delivery records (admission, delivery, gestational age, anesthesia, complications, placenta, newborn)
    // APGAR Scores
    'apgar_scores',  // ← APGAR scores (birth date/time, 1/5/10 minute scores, appearance, pulse, grimace, activity, respiration, interventions, recommendations)
    // Newborn Screening Results
    'newborn_screening_results',  // ← Newborn screening results (assessment date, program type, findings, goals, progress, follow-up, recommendations)
    // NICU Progress Notes
    'nicu_progress_notes',  // ← NICU progress notes (gestational age, weight, respiratory, feeding, bilirubin, access lines, complications)
    // Maternal Labs
    'maternal_labs',  // ← Maternal labs (blood type, antibody screen, glucose screening, infectious disease panel, GBS status)
    // Maternal Weight Monitoring
    'maternal_weight_monitoring',  // ← Maternal weight monitoring (pre-pregnancy weight, current weight, total weight gain, BMI, nutritional counseling)
    // Pregnancy Symptoms
    'pregnancy_symptoms',  // ← Pregnancy symptoms (nausea, heartburn, back pain, edema, sleep disturbance, urinary frequency, skin changes)
    // Birth Plan
    'birth_plan',  // ← Birth plan (delivery preference, pain management, labor support, immediate postpartum, feeding plan, visitors policy)
    // Anticipatory Guidance
    'anticipatory_guidance',  // ← Anticipatory guidance (nutrition, physical activity, screen time, sleep, safety, dental, social development, toileting, discipline)
    // ADHD Assessment
    'adhd_assessment',  // ← ADHD assessment (parent form scores, teacher form, symptoms, DSM criteria, differential diagnosis, comorbidities, recommendations)
    // Parental Concerns
    'parental_concerns',  // ← Parental concerns (concerns with topic/description/addressed, family support, home environment, assessment, plan)
    // Disability Evaluations
    'disability_evaluations',  // ← Disability evaluations (TTD, TPD, PTD, PPD, impairment rating, AMA Guides, workers compensation)
    // Mechanism of Injury
    'mechanism_of_injury',  // ← Mechanism of injury (injury mechanism, activity, symptoms, causation, treatment, time to surgery)
    // Postpartum Planning
    'postpartum_planning',  // ← Postpartum planning (insulin discontinuation, glucose testing, breastfeeding, risk reduction, future pregnancy)
    // Postpartum Notes
    'postpartum_notes',  // ← Postpartum notes (delivery info, recovery, lactation, screening scores, bowel/bladder, immunizations, discharge guidance)
    // Pregnancy Risk Assessment
    'pregnancy_risk_assessment',  // ← Pregnancy risk assessment (risk factors, risk level, consultations, surveillance plan, antenatal testing)
    // Preeclampsia Monitoring
    'preeclampsia_monitoring',  // ← Preeclampsia monitoring (BP, proteinuria, labs, fetal assessment, symptoms, HELLP syndrome, magnesium sulfate)
    // Risk Counseling
    'risk_counseling',  // ← Risk counseling (risks discussion, prognosis counseling, emotional support)
    // Cultural Considerations
    'cultural_considerations',  // ← Cultural considerations (dietary preferences, family dynamics, support strategies, cultural resources)
    // Thyroid Management
    'thyroid_management',  // ← Thyroid management (medication, dosage, monitoring schedule, target levels, findings)
    // Reproductive History
    'reproductive_history',  // ← Reproductive history (menstrual history, contraceptive history, sexual history, findings)
    // Donor Egg Cycle
    'donor_egg_cycle',  // ← Donor egg cycle (donor profile, stimulation, retrieval, fertilization, embryo results, recipient prep, transfer)
    // Fertility Tracking
    'fertility_tracking',  // ← Fertility tracking (cycle tracking, hormone levels, cervical assessment, ovarian/uterine, sperm parameters)
    // Single Embryo Transfer
    'single_embryo_transfer',  // ← Single embryo transfer (embryo details, cryopreservation, transfer procedure, medications, genetic testing)
    'single_embryo_transfer_details',  // ← Single embryo transfer details (embryo quality, endometrial, catheter, transfer specifics)
    'ivf_cycle_monitoring',  // ← IVF cycle monitoring (follicle counts, estradiol, LH, gonadotropin doses, trigger)
    'egg_retrieval_procedure',  // ← Egg retrieval procedure (oocytes retrieved, mature/immature, anesthesia, complications)
    'embryo_transfer_procedure',  // ← Embryo transfer procedure (Gardner grading, catheter, PGT, luteal support)
    'sperm_analysis',  // ← Sperm analysis (WHO semen params)
    'intrauterine_insemination',  // ← Intrauterine insemination (sperm prep, stimulation, procedure)
    'surrogacy_evaluation',  // ← Surrogacy/gestational carrier evaluation
    'ovarian_stimulation_protocol',  // ← Ovarian stimulation protocol (gonadotropin type/dose, trigger, follicle output rate)
    'fertility_medication_management',  // ← Fertility medication management (gonadotropins, GnRH, trigger, luteal support, adjuncts)
    // Cancer Screening Records
    'cancer_screening_records',  // ← Cancer screening records (pap smear, mammography, colonoscopy, PSA, lung screening)
    // Caregiver Assessment
    'caregiver_assessment',  // ← Caregiver assessment (primary caregiver, burden, support services, education provided)
    // Vaccination Records
    'vaccination_records',  // ← Vaccination records (immunization history with lot numbers)
    // Home Monitoring
    'home_monitoring',  // ← Home monitoring (BP, glucose, weight, peak flow, O2 saturation)
    // Medication Recommendations
    'medication_recommendations',  // ← Clinical medication recommendations (therapy recommendations, guidelines)
    // Infectious Disease Assessment
    'infectious_disease_assessment',  // ← Infectious disease assessment
    // Infection Control Records
    'infection_control_records',  // ← Infection control records (infection type, pathogen, isolation precautions, MDR, contact tracing, outbreak, NHSN surveillance, PPE, environmental cleaning)
    // Infection Risk Monitoring
    'infection_risk_monitoring',  // ← Infection risk monitoring (temperature, WBC, CRP, procalcitonin, ESR, blood/urine/wound/sputum cultures, SOFA, qSOFA, sepsis, isolation, MRSA, C. diff)
    // Infection Surveillance
    'infection_surveillance',  // ← Infection surveillance (HAI, CLABSI, CAUTI, SSI, pathogen, resistance, isolation, device-associated, outbreak, NHSN, antimicrobial therapy)
    // Isolation Precautions
    'isolation_precautions',  // ← Isolation precautions (precaution type, PPE, room type, door signage, cohorting, infection preventionist, adherence monitoring, education)
    // Antimicrobial Susceptibility
    'antimicrobial_susceptibility',  // ← Antimicrobial susceptibility (specimen, culture, organism, gram stain, antibiotics panel, MIC, resistance markers)
    // Psychiatric History
    'psychiatric_history',  // ← Psychiatric history
    // Addiction Medicine Consultations
    'addiction_medicine_consultations',  // ← Addiction medicine consultations (substance use history, MAT, treatment planning)
    'case_management',  // ← Case management (referral status, services, barriers, coordinator)
    // Pain Management Plan
    'pain_management_plan',  // ← Pain management plans (current analgesics, interventional procedures, consultations, supportive devices)
    'pain_assessment_forms',  // ← Pain assessment forms (pain scales, questionnaires, rating tools)
    'interventional_pain_procedures',  // ← Interventional pain procedures (nerve blocks, epidural injections, spinal injections)
    'pain_medication_agreements',  // ← Pain medication agreements (opioid agreements, medication contracts, prescribing agreements)
    'multimodal_pain_therapy',  // ← Multimodal pain therapy (combined pain therapy, integrative pain management)
    'opioid_risk_assessment',  // ← Opioid risk assessment (opioid risk tool, MEDD, substance abuse history, naloxone)
    // Harm Reduction Counseling
    'harm_reduction_counseling',  // ← Harm reduction counseling (needle exchange, overdose prevention, safer use strategies)
    // Chief Complaints
    'chief_complaints',  // ← Chief complaints (presenting complaint, reason for visit, primary complaint)
    // Mental Health Assessments
    'mental_health_assessments',  // ← Mental health assessments (PHQ-9, GAD-7, mental status exam, risk assessments, treatment planning)
    // Depression Screening
    'depression_screening',  // ← Depression screening (PHQ-9, severity, social isolation, mental health referrals)
    // Exercise Recommendations
    'exercise_recommendations',  // ← Exercise recommendations (cardiac rehab, aerobic, resistance training, flexibility, MET goals)
    'exercise_program',  // ← Exercise program (walking, yoga, dance fitness, resistance training, phased progression)
    'exercise_prescription',  // ← Exercise prescription (diagnosis, fitness level, goals, frequency, protocols, equipment, clearance)
    'medical_certificates',  // ← Medical certificates (report type, clinical indication, findings, recommendations, follow-up)
    // Treatment Goals
    'treatment_goals',  // ← Treatment goals (short-term, long-term, immediate, measurable outcomes, timeframes)
    // Psychiatric Evaluations
    'psychiatric_evaluations',  // ← Psychiatric evaluations (mental status exam, psychiatric history, diagnosis, treatment plan)
    'psychiatric_treatment_plan',  // ← Psychiatric treatment plan (goals, interventions, medications, therapy, follow-up)
    // Medication Safety
    'medication_safety',  // ← Medication safety (avoid medications, drug interactions, renal dosing, contrast restrictions)
    // Doctor's Medication Recommendations
    'doctors_medication_recommendations',  // ← Doctor's medication recommendations (singular legacy)
    'doctors_medications_recommendations',  // ← ACTUAL data collection name (plural)
    // Colorectal Colonoscopies
    'colorectal_colonoscopies',  // ← Colorectal colonoscopy reports (polyps, lesions, biopsies)
    // Colorectal Surgery Consultations
    'colorectal_surgery_consultations',  // ← Colorectal surgery consultations (diagnosis, TNM staging, surgical approach)
    // Hematology Consultations
    'hematology_consultations',  // ← Hematology consultations (blood disorders, chemotherapy, transplant eligibility)
    // Hormone Panels
    'hormone_panels',  // ← Hormone panels (TSH, T4, T3, cortisol, testosterone, vitamin D, PTH, DHEA-S, antibodies)
    // Oncology Consultations
    'oncology_consultations',  // ← Oncology consultations (cancer consultations, treatment recommendations, staging)
    // Oncology Treatment Plans
    'oncology_treatment_plans',  // ← Oncology treatment plans (immediate interventions, pending procedures, rehabilitation, goals)
    // Omissions & Refusals
    'omissions_refusals',  // ← Omissions & refusals (refusal type, refused medications, procedures, diagnostic tests, consent, contraindications)
    // Oncology Follow-up Reports
    'oncology_followup_reports',  // ← Oncology follow-up reports (progression-free interval, disease status, adverse events, tumor markers)
    // Oncology Team
    'oncology_team',  // ← Oncology team (multidisciplinary care team members, roles, contact information)
    // Cancer Diagnosis
    'cancer_diagnosis',  // ← Cancer diagnosis (primary site, histology, grade, tumor size, lymph node status, biomarkers, genetic mutations, IHC)
    // Cancer Surveillance
    'cancer_surveillance',  // ← Cancer surveillance (HCC surveillance, tumor monitoring, AFP, ultrasound, surveillance intervals)
    'liver_transplant_evaluation',  // ← Liver transplant evaluation (MELD, Child-Pugh, HCC, portal hypertension, psychosocial)
    'lung_transplant_evaluation',  // ← Lung transplant evaluation (pulmonary function, hemodynamics, immunology, LAS)
    'stem_cell_transplant_assessment',  // ← Stem cell transplant assessment (HLA, conditioning, engraftment, GVHD, serostatus, TMA)
    'bleeding_risk_assessment',  // ← Bleeding risk assessment (risk factors, anticoagulation, labs, mitigation)
    'diabetes_management_plan',  // ← Diabetes management plan (insulin admin, monitoring, meal plan, target ranges)
    'pump_advanced_settings',  // ← Insulin pump advanced settings (device, basal/bolus, target glucose, safety)
    'pancreas_transplant_evaluation',  // ← Pancreas transplant evaluation (diabetes type, C-peptide, HbA1c, hypoglycemia, vascular, immunology)
    'liver_transplant_follow_up',  // ← Liver transplant follow-up (immunosuppression, LFTs, rejection, viral surveillance, DSA)
    'lung_transplant_follow_up',  // ← Lung transplant follow-up (spirometry, CLAD, immunosuppression, infections, bronchoscopy, graft function)
    // Cancer Staging
    'cancer_staging',  // ← Cancer staging (TNM, ISS, R-ISS, Durie-Salmon, Ann Arbor, FIGO, WHO grading, IPI scores)
    // Tumor Markers
    'tumor_markers',  // ← Tumor markers (CEA, CA 19-9, CA 125, AFP, PSA, LDH, alkaline phosphatase, other markers)
    // Tumor Marker Panels
    'tumor_marker_panels',  // ← Tumor marker panels (AFP, molecular markers, results, findings, assessment)
    // Genetic Oncology
    'genetic_oncology',  // ← Genetic oncology (family history, genetic counseling, genetic testing, preventive recommendations)
    // Surgical Oncology
    'surgical_oncology',  // ← Surgical oncology (tumor resection, pathology findings, margins, lymph nodes, complications)
    'endocrine_therapy',  // ← Endocrine therapy (hormone therapy, aromatase inhibitors, side effect management)
    // Survivorship Care Plan
    'survivorship_care_plan',  // ← Survivorship care plan (follow-up schedule, surveillance tests, late effects, health maintenance)
    // Cognitive Evaluations
    'cognitive_evaluations',  // ← Cognitive evaluations (MMSE, CDR, cognitive testing, mental status assessment)
    // Fall Risk Assessments
    'fall_risk_assessments',  // ← Fall risk assessments (Timed Up and Go, Berg Balance, gait assessment, fall history)
    'falls_prevention_program_assessment',  // ← Falls prevention/rehab program assessment
    'pharmacy_review',  // ← Pharmacy review (medication review, drug interactions, DUR)
    // Geriatric Assessments
    'geriatric_assessments',  // ← Geriatric assessments (ADL, IADL, MMSE, CDR, TUG, Berg Balance, MNA, GDS, frailty)
    'geriatric_cognitive_assessment',  // ← Geriatric cognitive assessment (MMSE, MoCA, CDR, Clock Drawing, behavioral symptoms)
    'geriatric_medications',  // ← Geriatric medications (Beers Criteria, safety warnings, drug interactions, dosage adjustments)
    'medications',  // ← Medications list (medication name, dose, frequency, route, prescriber)
    'medication_deprescribing',  // ← Medication deprescribing (Beers list, STOPP/START, taper schedules, falls risk, drug interactions)
    'nutritional_supplementation',  // ← Nutritional supplementation (supplement info, serum levels, nutritional screening, tolerance, concurrent medications)
    'respite_care',  // ← Respite care (diagnosis, assessment scores, physical status, medications, social support, dietary requirements)
    'postoperative_pain_management',  // ← Postoperative pain management (surgery info, pain assessment, medications, regional anesthesia, monitoring, recovery plan)
    // Polypharmacy Reviews
    'polypharmacy_reviews',  // ← Polypharmacy reviews (medication review, deprescribing, drug interactions, optimization)
    // Treatment Summary
    'treatment_summary',  // ← Treatment summary (primary diagnosis, treatment timeline, current status, disease status)
    // Neurological Exam
    'neurological_exam',  // ← Neurological exam (mental status, pupils, cranial nerves, speech, motor, sensory, reflexes, coordination, gait)
    // Pulmonology Consultations
    'pulmonology_consultations',  // ← Pulmonology/respiratory consultations (lung disease, respiratory management)
    // Pulmonary Rehabilitation Notes
    'pulmonary_rehabilitation_notes',  // ← Pulmonary rehabilitation notes (exercise, breathing, vital signs, scores, progress)
    // Arterial Blood Gases
    'arterial_blood_gases',  // ← Arterial blood gas assessments (ABG results, clinical status, interventions, patient response)
    // Blood Smears
    'blood_smears',  // ← Blood smear analysis (RBC morphology, inclusions, WBC differential)
    // Pulmonary Function Tests
    'pulmonary_function_tests',  // ← Pulmonary function tests (FEV1, FVC, DLCO, interpretation)
    // Neurosurgery Consultations
    'neurosurgery_consultations',  // ← Neurosurgery consultations (brain lesions, surgical approach, prognosis)
    // Neurological Assessment
    'neurological_assessment',  // ← Neurological assessments (clinical status, vital signs, interventions, response, plan)
    // Movement Disorder Assessment
    'movement_disorder_assessment',  // ← Movement disorder assessments (Parkinson's, tremor, dystonia, UPDRS scores)
    // Parkinsonian Features
    'parkinsonian_features',  // ← Parkinsonian features (tremor, bradykinesia, rigidity, postural instability - cardinal signs)
    // Gait Analysis
    'gait_analysis',  // ← Gait analysis (gait pattern, stride length, arm swing, freezing, festination, posture, assistive devices)
    // Motor Complications
    'motor_complications',  // ← Motor complications (wearing off, on-off phenomena, dyskinesias, off time, morning akinesia)
    // Non-Motor Symptoms
    'non_motor_symptoms',  // ← Non-motor symptoms (cognitive, neuropsychiatric, sleep, autonomic, sensory - Parkinson's)
    // Parkinson Medications
    'parkinson_medications',  // ← Parkinson medications (levodopa, dopamine agonists, MAO-B inhibitors, COMT inhibitors, amantadine)
    // Caregiver Support
    'caregiver_support',  // ← Caregiver support (burden score, ADLs/IADLs, health concerns, resources, coping strategies, home modifications)
    // Deep Brain Stimulation
    'deep_brain_stimulation',  // ← Deep brain stimulation (DBS status, target, laterality, programming settings, complications, response)
    // Sleep Disturbances
    'sleep_disturbances',  // ← Sleep disturbances (REM sleep behavior disorder, causes, interventions, sleep quality)
    // Neuropsychological Assessments
    'neuropsychological_assessments',  // ← Neuropsychological assessments (executive function, verbal fluency, processing speed, memory, cognitive domains, rehabilitation plan)
    // Neurology Consultations
    'neurology_consultations',  // ← Neurology consultations (referral, neurologic exam, diagnosis, treatment plan)
    // EMG Reports
    'emg_reports',  // ← EMG reports (electromyography, nerve conduction studies, needle examination, findings)
    // Complications
    'complications',  // ← Complications (intraoperative, immediate, management, findings, assessment)
    // Consultation Requests
    'consultation_requests',  // ← Consultation requests (requesting provider, consulting specialty, urgency, clinical question, diagnoses)
    // Disease Severity
    'disease_severity',  // ← Disease severity (overall severity, crisis frequency, complications, quality of life, prognostic factors)
    // Hematology Assessment
    'hematology_assessment',  // ← Hematology assessment (blood disorder, blood smear, hemoglobinopathy, treatment plan, chemotherapy, prognosis)
    // Myeloma Specific Data
    'myeloma_specific_data',  // ← Myeloma specific data (CRAB criteria, M-spike, light chains, beta-2 microglobulin, Bence Jones)
    // Transplant Assessment
    'transplant_assessment',  // ← Transplant assessment (eligibility, transplant type, timing, conditioning, HLA typing, donor search)
    // Prophylactic Medications
    'prophylactic_medications',  // ← Prophylactic medications (antimicrobials, bone supportive, gastric protection, DVT prophylaxis)
    // Brain Tumor Characteristics
    'brain_tumor_characteristics',  // ← Brain tumor characteristics (WHO grade, IDH1, MGMT, Ki-67)
    // Brain Tumor Molecular Markers
    'brain_tumor_molecular_markers',  // ← Brain tumor molecular markers (IDH, MGMT, 1p/19q, TERT, Ki-67)
    // Tractography Studies
    'tractography_studies',  // ← Tractography studies (white matter tracts, DTI, lesion relationship)
    // Functional MRI Studies
    'functional_mri_studies',  // ← Functional MRI studies (eloquent areas, brain mapping, surgical risk)
    // Bone Marrow Studies
    'bone_marrow_studies',  // ← Bone marrow studies (cytogenetics, karyotype, flow cytometry, FISH)
    'bone_marrow_reports',  // ← Bone marrow reports (biopsy, pathology, findings, assessment, plan)
    // Plastic Surgery Consultations
    'plastic_surgery_consultations',  // ← Plastic surgery consultations (reconstructive, informed consent, risks/benefits/alternatives)
    // Operative Reports
    'operative_reports',  // ← Operative reports (procedure details, surgical team, findings, complications, specimens)
    'operative_report_details',  // ← Operative report details (procedure name, surgeon, assistants, diagnosis, findings, specimens)
    'patient_positioning',  // ← Patient positioning (position type, details, padding, safety straps, devices, team, complications)
    'prep_and_drape',  // ← Prep and drape (prep area, solution, method, drape type, draping method, sterility verification)
    'pneumoperitoneum',  // ← Pneumoperitoneum (access method, location, pressure settings, gas settings, insufflation equipment)
    'critical_view_of_safety',  // ← Critical view of safety (CVS criteria, structures identified, clearance, safety steps)
    'intraoperative_cholangiography',  // ← Intraoperative cholangiography (IOC, bile duct visualization, contrast, findings, interpretation)
    // Pre-Operative Assessments
    'pre_operative_assessments',  // ← Pre-operative assessments (surgery clearance, ASA class, risk assessment, anesthesia plan)
    // Surgical Consent Forms
    'surgical_consent_forms',  // ← Surgical consent forms (informed consent, procedure consent, risks/benefits/alternatives discussed)
    'sponge_instrument_counts',  // ← Sponge/instrument counts (initial count, additional counts, final count, discrepancy, x-ray)
    // Surgical Approach
    'surgical_approach',  // ← Surgical approach (technique, positioning, port placement, incisions, pneumoperitoneum)
    // Intraoperative Findings
    'intraoperative_findings',  // ← Intraoperative findings (anatomy, pathology, adhesions, contamination, additional procedures)
    // Intraoperative Imaging
    'intraoperative_imaging',  // ← Intraoperative imaging (cholangiography, fluoroscopy, ultrasound)
    // Neuro Imaging (Advanced Functional Neuroimaging)
    'neuro_imaging',  // ← Advanced functional neuroimaging (fMRI, DTI, tractography)
    // Neurosurgery Assessment
    'neurosurgery_assessment',  // ← Neurosurgery assessment (functional MRI, tractography, tumor characteristics, surgical planning)
    // Postoperative Orders
    'postoperative_orders',  // ← Postoperative orders (diet, activity, pain management, antibiotics, prophylaxis, monitoring)
    // Operative Technique
    'operative_technique',  // ← Operative technique (step-by-step procedure, critical steps, hemostasis, irrigation, closure)
    // Specimens
    'specimens',  // ← Specimens (surgical specimens, tissue samples, pathology, handling, results)
    // Estimated Blood Loss
    'estimated_blood_loss',  // ← Estimated blood loss (EBL, blood loss amount, transfusion required, blood products given)
    // Postoperative Condition
    'postoperative_condition',  // ← Postoperative condition (recovery status, extubation location, transfer destination, PACU status)
    // Glaucoma Assessments
    'glaucoma_assessments',  // ← Glaucoma assessments (IOP, cup-to-disc ratio, visual field defects, optic nerve, gonioscopy)
    // Glaucoma Management
    'glaucoma_management',  // ← Glaucoma management (medical therapy, laser therapy, surgical consideration, IOP target, monitoring plan)
    // Ophthalmology Examinations
    'ophthalmology_examinations',  // ← Ophthalmology examinations (comprehensive eye exam, IOP, CCT, visual fields, diabetic retinopathy)
    // Optometry Examination
    'optometry_examination',  // ← Optometry examination (visual acuity, refraction, IOP, corneal thickness, optic nerve, macula, ocular surface)
    // Low Vision Evaluation
    'low_vision_evaluation',  // ← Low vision evaluation (visual acuity, contrast sensitivity, magnification, eccentric viewing, rehabilitation goals)
    // Vision Therapy Assessment
    'vision_therapy_assessment',  // ← Vision therapy assessment (convergence, accommodation, vergence, phoria, stereopsis, eye movements)
    // Contact Lens Fitting
    'contact_lens_fitting',  // ← Contact lens fitting (base curve, diameter, power, keratometry, tear film, fit assessment, wearing schedule)
    // Retinal Examinations
    'retinal_examinations',  // ← Retinal examinations (fundus exam, diabetic retinopathy, macular edema, OCT angiography, fluorescein angiography)
    // Visual Acuity Reports
    'visual_acuity_reports',  // ← Visual acuity reports (Snellen chart, distance vision, near vision, corrected/uncorrected)
    // Past Ocular History
    'past_ocular_history',  // ← Past ocular history (dilated exam, glasses/contacts, refractive error, prior eye surgery, eye trauma)
    // Ophthalmology Exam
    'ophthalmology_exam',  // ← Comprehensive ophthalmology exam (visual acuity, refraction, pupils, slit lamp, fundoscopy, OCT, IOP)
    // Consultation Details
    'consultation_details',  // ← Consultation details (specialist consultations, referrals, opinions, recommendations)
    // Social Work Notes
    'social_work_notes',  // ← Social work notes (assessments, barriers, interventions, care plans)
    // Social History
    'social_history',  // ← Social history (tobacco, alcohol, substance use, living situation, occupation, social support, SDOH)
    // Administrative data
    'administrative_data',
    // Reminders (System/Operational - NOT medical)
    'reminders',  // ← Patient reminders and notifications (appointment reminders, etc.)
    // Specialty documents
    'allergy_immunology_assessment',  // ← Allergy & Immunology Assessment
    // Challenge tests
    'challenge_tests',  // ← Food/Drug/Aspirin/Exercise challenge tests
    // Echocardiogram Reports
    'echo_reports',  // ← Echocardiogram reports (ejection fraction, cardiac measurements, valves)
    // ECG/EKG Reports
    'ecg_reports',  // ← ECG reports (rhythm, rate, PR interval, QRS, QT/QTc, axis, ST segment, T wave)
    // Sleep Study Reports
    'sleep_study_reports',  // ← Sleep study reports (polysomnography, sleep architecture, apnea events, AHI, recommendations)
    // Sleep Study
    // Coagulation Studies
    'coagulation_studies',  // ← Coagulation studies (PT, INR, PTT, fibrinogen, D-dimer, bleeding time)
    // Diabetes Management Notes
    'diabetes_management_notes',  // ← Diabetes management notes (HbA1c, glucose, insulin regimen, complications)
    // Diabetes Management
    'diabetes_management',  // ← Diabetes management (Type 1/2, HbA1c, glycemic metrics, insulin, complications, cardiovascular, lifestyle)
    // Endocrinology Consultations
    'endocrinology_consultations',  // ← Endocrinology consultations (diabetes, thyroid, PCOS, findings, assessment, plan, recommendations)
    // Endocrinology Assessment
    'endocrinology_assessment',  // ← Endocrinology assessment (thyroid function, parathyroid, adrenal, metabolic panel)
    // Ergonomic Assessment
    'ergonomic_assessment',  // ← Ergonomic assessment (workstation, RULA, REBA, body regions, physical demands, compliance, equipment modifications)
    // ENT Consultations
    'ent_consultations',  // ← ENT consultations (otolaryngology, ear, nose, throat, hearing, sinus, larynx, findings, assessment, plan)
    // Audiometry Reports
    'audiometry_reports',  // ← Audiometry reports (hearing test, audiogram, right/left ear thresholds, speech reception, word recognition, hearing loss type/severity)
    // Laryngoscopy Reports
    'laryngoscopy_reports',  // ← Laryngoscopy reports (laryngoscopy, nasopharyngolaryngoscopy, vocal cords, larynx, nasal cavity, oropharynx, findings, assessment)
    // Insomnia Assessment
    'insomnia_assessment',  // ← Insomnia assessment (sleep onset latency, sleep maintenance, sleep efficiency, ISI, CBT-I, sleep restriction, stimulus control)
    // Narcolepsy Assessment
    'narcolepsy_assessment',  // ← Narcolepsy assessment (cataplexy, MSLT, sleep-onset REM periods, hypocretin, Epworth, sleep attacks)
    // Sleep Disorder Assessment
    'sleep_disorder_assessment',  // ← Sleep disorder assessment (Epworth, PSQI, STOP-BANG, polysomnography, apnea, snoring, insomnia, narcolepsy, CPAP)
    // Sleep Apnea Management
    'sleep_apnea_management',  // ← Sleep apnea management (AHI, ODI, CPAP therapy, compliance, mask type, sleep study results, surgical interventions)
    // Sleep Hygiene Education
    'sleep_hygiene_education',  // ← Sleep hygiene education (bedtime routine, sleep schedule, caffeine, alcohol, environment, education topics, behavioral interventions)
    // Daytime Sleepiness Assessment
    'daytime_sleepiness_assessment',  // ← Daytime sleepiness assessment (Epworth score, sleep latency, cataplexy, sleep paralysis, driving impairment, medications)
    // Workplace Accommodations
    'workplace_accommodations',  // ← Workplace accommodations (ADA, functional capacity, cognitive accommodations, neurological impairments, return to work)
    // Thyroid Evaluations
    'thyroid_evaluations',  // ← Thyroid evaluations (thyroid function, Hashimoto's, Graves', TSH, T3/T4, findings, assessment, plan)
    // Insulin Pump Settings
    'insulin_pump_settings',  // ← Insulin pump settings (basal rates, carb ratios, correction factor, target glucose, pump model, recommendations)
    // CGM Data
    'cgm_data',  // ← CGM data (continuous glucose monitoring, averageGlucose, gmi, timeInRange, timeBelowRange, timeAboveRange, coefficientOfVariation)
    // Insulin Regimen
    'insulin_regimen',  // ← Insulin regimen (pump/MDI, basalInsulin, bolusInsulin, mealDoses, correctionDoses, totalDailyDose, basalBolusRatio)
    // Insulin Timing Instructions
    'insulin_adjustment_protocol',  // ← Insulin adjustment protocol (fastingAdjustment, mealTimeAdjustment, thresholds, contactInstructions, notes)
    'insulin_timing_instructions',  // ← Insulin timing instructions (insulinType, dosing, timing, pharmacokinetics, slidingScale, mealTiming, injectionSites)
    'insulin_storage_instructions',  // ← Insulin storage instructions (insulinType, brandName, storage, safety, travel, disposal)
    'glucose_monitoring_frequency',  // ← Glucose monitoring frequency (current, recommended, adjustments, concerns, notes)
    'medical_power_of_attorney',  // ← Medical power of attorney (principal, agent, directives, DNR, DNI, conditions, witnesses)
    'medical_reconciliation_forms',  // ← Medical reconciliation forms (medications, allergies, interactions, adherence, changes, safety)
    'neuromuscular_disorder',  // ← Neuromuscular disorder (diagnosis, MRC scale, atrophy, fasciculations, respiratory, bulbar, ALSFRS)
    'home_health_orders',  // ← Home health orders (physician, agency, skilled services, DME, functional limitations, safety, homebound status)
    'ed_triage_assessment',  // ← ED triage assessment (triage level, vitals, pain, allergies, medications, neurological status)
    'emergency_observation_unit',  // ← Emergency observation unit (chief complaint, vitals, troponins, ECGs, treatment, discharge)
    'eeg_reports',  // ← EEG reports (indication, technique, background, abnormalities, epileptiform activity, seizures, interpretation)
    // Ketone Monitoring Instructions
    'ketone_monitoring_instructions',  // ← Ketone monitoring instructions (whenToCheck, interpretation, actionRequired, provider, facility)
    // Carbohydrate Counting Education
    'carbohydrate_counting_education',  // ← Carbohydrate counting education (diabetesType, HbA1c, insulin, glucose targets, skills, meal timing, objectives, followUp)
    // Partner Involvement Diabetes Management
    'partner_involvement_diabetes_management',  // ← Partner involvement diabetes management (knowledge, emergency, monitoring, medication, dailyCare, followUp, complications)
    // Excessive Glucose Monitoring
    'excessive_glucose_monitoring',  // ← Excessive glucose monitoring (provider, facility, frequency, clinical, psychological, impact, intervention, triggers)
    // Diabetes Education
    'diabetes_education',  // ← Diabetes education (topic, educator, materials, patientDemonstration, education topics, self-management)
    // Hypoglycemia Management
    'hypoglycemia_management',  // ← Hypoglycemia management (frequency, severity, symptoms, treatment, glucagon, unawareness, episode overview)
    // Preconception Counseling
    'preconception_counseling',  // ← Preconception counseling (planning, targetHbA1c, contraception, medicationAdjustments, folicAcid, risksDiscussed, geneticCounseling)
    // Diabetes Quality Metrics
    'diabetes_quality_metrics',  // ← Diabetes quality metrics (hemoglobinA1c, bloodPressure, ldlCholesterol, albuminuria, diabeticRetinopathy, footExam, statin, aceInhibitor, smokingStatus, vaccinations)
    // Pump Download Analysis
    'pump_download_analysis',  // ← Pump download analysis (bolusesPerDay, correctionBolusesPerDay, controlIQActivePercent, autoModeExits, missedBoluses, overrideBehavior)
    // Foot Exam
    'foot_exam',  // ← Foot exam (ulcers, calluses, deformities, nailCondition, skinCondition, circulation, sensation, footwear, monofilament, pedal pulses)
    // Wound Healing Hyperbaric
    'wound_healing_hyperbaric',  // ← Wound healing hyperbaric (woundEtiology, wagnerClassification, ABI, TBI, TcPO2, HBOT pressure/duration/sessions, infection, osteomyelitis, healing trajectory)
    // Hyperbaric Oxygen Therapy
    'hyperbaric_oxygen_therapy',  // ← Hyperbaric oxygen therapy (chamberType, treatmentPressureATA, oxygenBreathingPeriods, woundHealingResponse, wagnerGrade, barotrauma, tympanometry)
    // Decompression Sickness Treatment
    'decompression_sickness_treatment',  // ← Decompression sickness treatment (treatmentTableUsed, totalHyperbaricOxygenTime, maximumTreatmentDepth, dcsType, arterialGasEmbolismSuspected, returnToDivingClearance)
    // Diabetic Foot Assessment
    'diabetic_foot_assessment',  // ← Diabetic foot assessment (Wagner, UT classification, ABI, TBI, TcPO2, monofilament, Charcot, wound assessment, offloading)
    // Podiatry Templates
    'podiatry_consultations',  // ← Podiatry consultations (chief complaint, vascular, neuropathy, biomechanical, nail/toe deformities, treatment)
    'podiatry_examinations',  // ← Podiatry examinations (neuropathy/vascular/structure/skin/nail exam, risk stratification, treatment plan)
    'bunion_surgery_evaluation',  // ← Bunion surgery evaluation (HVA, IMA, sesamoid, joint assessment, surgical plan, risk)
    'heel_pain_assessment',  // ← Heel pain assessment (plantar fasciitis grading, windlass test, imaging, differential diagnosis)
    'ingrown_toenail_treatment',  // ← Ingrown toenail treatment (nail stage, avulsion, phenolization, postop care, risk)
    'plantar_fasciitis_management',  // ← Plantar fasciitis management (pain, clinical tests, imaging, treatment interventions)
    'foot_orthotics_assessment',  // ← Foot orthotics assessment (weight bearing, biomechanical, gait, orthotic prescription)
    // Obstetric/Postpartum Templates
    'breastfeeding_recommendation',  // ← Breastfeeding recommendation (maternal info, infant info, feeding assessment, goals)
    'postpartum_diabetes_risk',  // ← Postpartum diabetes risk (glucose metrics, risk factors, metabolic profile)
    'gdm_recurrence_risk',  // ← GDM recurrence risk (recurrence score, glucose status, risk factors, weight)
    'postpartum_glucose_monitoring',  // ← Postpartum glucose monitoring (timeline, findings, assessment, plan)
    'total_weight_gain',  // ← Total weight gain (amount, findings, assessment, notes)
    'pre_pregnancy_weight',  // ← Pre-pregnancy weight (measurements, history, risk factors, interventions)
    'early_maternity_leave',  // ← Early maternity leave (status, employment, clearance, return plan)
    'inter_pregnancy_weight_management',  // ← Inter-pregnancy weight management (metrics, interventions, metabolic)
    // Oncology Templates
    'toxicity_assessment',  // ← Toxicity assessment (CTCAE, adverse events, dose modifications, supportive care)
    'oncologic_emergencies',  // ← Oncologic emergencies (neutropenic fever, tumor lysis, hypercalcemia, cord compression)
    'pre_chemotherapy_workup',  // ← Pre-chemotherapy workup (infectious screening, cardiac, fertility, dental, eligibility)
    // Occupational Health Templates

    'fitness_for_duty_evaluations',  // ← Fitness for duty (pulmonary, vision, hearing, cardiovascular, musculoskeletal)
    'employment_counseling',  // ← Employment counseling (functional capacity, job analysis, return to work)
    'pre_employment_physical',  // ← Pre-employment physical (clearance, screenings, physical assessment)
    // Prenatal/OB Templates
    'prenatal_testing_reports',  // ← Prenatal testing reports (NIPT, trisomy risk, fetal sex, biochemistry)
    'maternal_fetal_reports',  // ← Maternal fetal reports (biometry, doppler, fetal wellbeing, placenta)
    'ultrasound_ob_reports',  // ← Ultrasound OB reports (anatomy scan, biometry, placenta, fluid)
    'macrosomia_threshold',  // ← Macrosomia threshold (fetal weight, maternal factors, delivery outcomes)
    // Psychiatric/Behavioral Health Templates
    'psychiatric_discharge_summaries',  // ← Psychiatric discharge summaries
    'psychiatric_progress_notes',  // ← Psychiatric progress notes
    'homicide_risk_assessment',  // ← Homicide risk assessment
    'psychiatric_review',  // ← Psychiatric review (medication, labs, metabolic)
    'behavioral_health_goals',  // ← Behavioral health goals
    // Hourly Vital Signs
    'hourly_vital_signs',  // ← Hourly vital signs (BP, HR, RR, temp, SpO2, MAP, CVP, urine output, consciousness, pain score, blood glucose)
    // Peripheral Artery Disease
    'peripheral_artery_disease',  // ← Peripheral artery disease (ABI, TBI, Rutherford, Fontaine, claudication, duplex ultrasound, CTA, revascularization, amputation risk)
    // Integrative Oncology
    'integrative_oncology',  // ← Integrative oncology (complementary therapies, nutritional support, exercise program, mind-body practices, acupuncture, supplements)
    // Skin Grafting Evaluation
    'skin_grafting_evaluation',  // ← Skin grafting evaluation (graft donor site, thickness, expansion ratio, recipient bed vascularity, graft take, fixation, NPWT, Vancouver scar scale)
    // Pressure Injury
    'pressure_injury',  // ← Pressure injury (location, stage, size, type, description, treatment, prevention, findings, assessment, plan, recommendations)
    // Work Accommodations
    'work_accommodations',  // ← Work accommodations (currentStressors, recommendedAccommodations, leaveStatus, ADA, FMLA, workplace disability)
    // Chronic Disease Management
    'chronic_disease_management',  // ← Chronic disease management (diabetes, hypertension, COPD, CHF, asthma, CAD, management plans, HEDIS metrics)
    // COPD Assessments
    'copd_assessments',  // ← COPD assessments (spirometry, symptoms, exacerbations, management plans, clinical evaluations)
    // Bronchial Hygiene Therapy
    'bronchial_hygiene_therapy',  // ← Bronchial hygiene therapy (chest physiotherapy, postural drainage, HFCWO, PEP, sputum, auscultation, mucolytic)
    // Airway Clearance Therapy
    'airway_clearance_therapy',  // ← Airway clearance therapy (chest physiotherapy, HFCWO, PEP, IPV, MI-E, sputum, cough flow, postural drainage, Borg scale)
    // Respiratory Therapy Assessment
    'respiratory_therapy_assessment',  // ← Respiratory therapy assessment (ventilator mechanics, ABG, oxygenation, airway, weaning readiness)
    // Oxygen Titration Protocol
    'oxygen_titration_protocol',  // ← Oxygen titration protocol (SpO2, FiO2, ABG, titration, weaning, HFNC, PEEP, delivery device, respiratory failure risk)
    // Microbiology Culture Reports
    'microbiology_culture_reports',  // ← Microbiology culture reports (organism identification, sensitivities, resistance patterns)
    'respiratory_medications',  // ← Respiratory medications (controllers, relievers, biologics, nebulizers, oral corticosteroids)
    // Review of Systems
    'review_of_systems',  // ← Review of systems with organ system assessment (constitutional, cardiovascular, respiratory, neurological, psychiatric, etc.)
    // Hepatitis C History
    'hepatitis_c_history',  // ← Hepatitis C history (past treatments, outcomes, relapses, coinfections, cirrhosis, complications)
    // Hepatitis C Management
    'hepatitis_c_management',  // ← Hepatitis C management (genotype, viral load, treatment status, DAA regimen, liver assessment, fibrosis staging)
    // Prior Authorization Forms
    'prior_authorization_forms',  // ← Prior authorization forms (medication/procedure authorization, insurance coverage, approval status)
    // Insurance Authorizations
    'insurance_authorizations',  // ← Insurance authorizations (coverage verification, copay assistance, medication coverage)
    // Family History
    'family_history',  // ← Family history (hereditary conditions, genetic predispositions, family diseases, family medical history)
      // Assessment Plans
      'assessment_plans',  // ← Assessment plans (diagnoses, medications, procedures, testing, patient education, follow-up)
      'psychosocial_assessments', // ← Psychosocial assessments
      'substance_use_assessment', // ← Substance use assessment
      'therapy_session_notes', // ← Therapy session notes (session type, presenting issues, interventions, risk assessment)
      'therapy_progress_notes', // ← Therapy progress notes (subjective report, outcome measures, interventions, compliance)
      'stress_management_referrals', // ← Stress management referrals (MBSR, mindfulness, biofeedback, yoga, relaxation therapy)
      'suicide_risk_assessment', // ← Suicide risk assessment (ideation, plan, risk factors, protective factors, interventions)
      'supplementation_plans', // ← Supplementation plans (supplement, dosage, condition, reasoning, findings, provider)
      'medication_changes_new', // ← Medication changes new (new medications, prescriptions, therapeutic class, safety screening)
      'follow_up_plan', // ← Follow-up plan (interval, reason, modality, monitoring, medications, labs, imaging, referrals)
      'medical_alerts', // ← Medical alerts (allergy alerts, drug interactions, fall risk, critical lab values, panic values)
      'orthopedic_consultations', // ← Orthopedic consultations (musculoskeletal evaluation, joint assessment, fractures, arthritis)
      'pain_management_notes', // ← Pain management notes (chronic pain, acute pain, pain assessment, pain medications, interventions)
      'malnutrition_risk_assessment', // ← Malnutrition risk assessment (screening tool, risk score, BMI, weight loss, dietary intake, interventions)
      'appetite_stimulants', // ← Appetite stimulants (medications, appetite enhancement, megestrol, dronabinol, nutritional support)
      'prn_medications', // ← PRN medications (as-needed medications, name, dosage, frequency, route, prescriber, indication, safety warning)
      'nursing_notes', // ← Nursing notes (assessment date, assessment time, clinical status, vital signs, interventions, response, plan, recommendations)
      'nurse_signatures', // ← Nurse signatures (nurse info, shift details, verifications, interventions, clinical scores, supervisor, incidents)
      'pain_functional_assessment', // ← Pain functional assessment (pain intensity, functional impact, mobility, ROM, medications, interventions, goals)
      'physical_examinations', // ← Physical examinations (general exam, vital signs, HEENT, cardiovascular, respiratory, abdominal, neurological)
      'blood_products_ordered', // ← Blood products ordered (transfusion orders, PRBC, FFP, platelets, cryoprecipitate, crossmatch, blood bank orders)
      'dvt_prophylaxis', // ← DVT prophylaxis (medication, dose, duration, mechanical prophylaxis, VTE risk assessment)
      'clinical_risk_scores', // ← Clinical risk scores (APACHE II, SOFA, CHA2DS2-VASc, MELD - detailed risk assessments with predicted mortality/morbidity)
      'antibiotic_stewardship', // ← Antibiotic stewardship (antibiotic name, class, culture sensitivity, biomarker values, de-escalation, renal adjustment)
      'antibiogram_reports', // ← Antibiogram reports (organism, specimen source, antibiotics tested, susceptibilities, MIC values, resistance pattern, method, interpretation)
      'anticoagulation_management', // ← Anticoagulation management (warfarin, heparin, DOACs, INR/aPTT, dose adjustments)
      'tpn_management', // ← TPN management (total parenteral nutrition, TPN orders, macronutrients, electrolytes, lipid emulsion, venous access, monitoring)
      'liver_function_assessments', // ← Liver function assessments (hepatic panel, LFTs, AST/ALT, bilirubin, albumin)
      'nutrition_assessments', // ← Nutrition assessments (dietary evaluation, calorie intake, protein goals, pre-op diet)
      'enteral_feeding_assessment', // ← Enteral feeding assessment (tube feeding, formula, feeding tolerance, nutritional goals, safety)
      'nutrition_lab_monitoring', // ← Nutrition lab monitoring (visceral proteins, trace elements, vitamins, iron studies, indices)
      'dietary_interventions', // ← Dietary interventions (nutrition plans, diet modifications, meal planning, therapeutic diets)
      'south_asian_nutritionist',  // ← South Asian nutritionist (culturally adapted nutrition, CANE framework, family dynamics, meal plans)
      'indian_diet_exchange_lists',  // ← Indian diet exchange lists (carb exchanges, roti, rice, dal, sabzi, glycemic index, festival foods)
      'hydration_management',  // ← Hydration management (fluid balance, serum sodium, BUN, skin turgor, edema, fluid restriction)
      'ckd_management', // ← CKD management (chronic kidney disease, eGFR, UACR, KFRE, renal protection, dialysis planning)
      'food_insecurity', // ← Food insecurity (food access, nutrition programs, SNAP, food bank, meal delivery)
      'barriers_psychosocial_issues', // ← Barriers and psychosocial issues (financial, transportation, housing, literacy, mental health, social support)
      'social_determinants_of_health', // ← Social determinants of health (housing, food security, financial barriers, transportation, insurance)
      'medication_access_programs', // ← Medication access programs (patient assistance, 340B, charity care, applications pending, alternatives)
      'biologic_therapy', // ← Biologic therapy (flat collection: medication, indication, dose, route, frequency, response, monitoring)
      'biologic_therapy_records', // ← Biologic therapy records (biologic agent, indication, prior therapies, response assessment, adverse events, insurance)
      'asthma_management_notes', // ← Asthma management notes (asthma type, severity, control level, symptoms, triggers, medications, action plan)
      'biopsy_reports', // ← Biopsy reports (site, method, clinical history, gross/microscopic description, diagnosis, adequacy, pathologist)
      'oral_pathology_biopsy', // ← Oral pathology biopsy (specimen site, biopsy technique, histopathologic diagnosis, dysplasia grade, tumor staging, margins, IHC panel)
      'pathology_reports', // ← Pathology reports (specimen type/source, clinical history, gross/microscopic description, special stains, IHC, molecular studies, diagnosis, staging)
      'pathology_gross_description', // ← Pathology gross description (specimen info, gross appearance, lesion description, margins, lymph nodes, processing details)
      'genetic_testing_reports', // ← Genetic testing reports (molecular profiling, IDH, MGMT methylation, 1p/19q codeletion, EGFR, TP53, ATRX, Ki67)
      'comprehensive_cardiomyopathy_panel', // ← Comprehensive cardiomyopathy panel (LVEF, NYHA class, echo measurements, biomarkers, genetic testing)
      'cascade_testing_protocol', // ← Cascade testing protocol (family testing, predictive testing, at-risk relatives, cascade genetic testing)
      'potential_testing_outcomes', // ← Potential testing outcomes (test results, findings, assessment, plan, recommendations)
      'reason_for_referral', // ← Reason for referral (referral reason, indication, findings, assessment, plan, recommendations)
      'medical_geneticist', // ← Medical geneticist (genetics consultation, genetic counseling, findings, assessment, plan, recommendations)
      'transplant_evaluations', // ← Transplant evaluations (transplant assessment, organ transplant, kidney/liver transplant eval)
      'heart_transplant_evaluation', // ← Heart transplant evaluation (cardiac transplant, UNOS listing, hemodynamics, immunologic profile)
      'dialysis_records', // ← Dialysis records (hemodialysis, blood flow rate, Kt/V, fluid removal, vascular access, dialysate bath)
      'dialysis_run_sheets', // ← Dialysis run sheets (BP parsing, machine info, treatment parameters, fluid management)
      'pre_dialysis_assessment', // ← Pre-dialysis assessment (GFR, CKD stage, creatinine, BUN, hematology, bone mineral, vascular access, cardiovascular, infectious screening)
      'dialysis_prescription', // ← Dialysis prescription (modality, frequency, duration, blood flow, dialysate composition, UF, vascular access, anticoagulation, adequacy targets, medications)
      'dialyzer', // ← Dialyzer (model, membrane, clearance rates, volume, pressure, sterilization, biocompatibility, reuse, transport)
      'dialysate_composition', // ← Dialysate composition (electrolytes, physical properties, flow rate, buffer, quality control, supply, additives)
      'intradialytic_monitoring', // ← Intradialytic monitoring (weight, ultrafiltration, pressures, vital signs trends, dialysate settings, anticoagulation, complications)
      'medications_administered', // ← Medications administered (name, dosage, route, frequency, indication, instructions, side effects, drug interactions)
      'post_dialysis_assessment', // ← Post dialysis assessment (vital signs, fluid management, adequacy, vascular access, complications, recovery)
      'renal_protection_plan', // ← Renal protection plan (assessment, nephrotoxin avoidance, monitoring, plan, consultations)
      'current_dialysis', // ← Current dialysis (modality, schedule, prescription, adequacy, complications, assessment, plan)
      'endoscopy_reports', // ← Endoscopy reports (procedure type, indication, findings, biopsy, polyps, complications, follow-up)
      'cognitive_rehabilitation_reports', // ← Cognitive rehabilitation reports (neuropsych eval, executive function, memory, language, attention)
      'therapy_requests', // ← Therapy requests (therapy orders, rehab requests, physical/occupational/speech therapy, functional goals, authorization)
      'surgical_steps', // ← Surgical steps (operative procedure, surgical technique, instruments, equipment, phases, anesthesia, complications)
      'surgical_team', // ← Surgical team (primary surgeon, assistant surgeons, anesthesiologist, scrub nurse, circulating nurse, residents, students)
      'preoperative_evaluation', // ← Preoperative evaluation (ASA classification, Mallampati score, cardiovascular risk, airway assessment, anesthesia planning)
      'operative_details', // ← Operative details (surgical team, procedures, perioperative protocol, surgical plan)
      'neurological_examination', // ← Neurological examination (mental status, cranial nerves, motor, sensory, reflexes, coordination, gait, MoCA score)
      'sports_medicine_evaluations', // ← Sports medicine evaluations (cardiac screening, musculoskeletal exam, clearance status, return to play)
      'orthopedic_followup_notes',  // ← Orthopedic follow-up notes (pain, ROM, strength, gait, rehab, imaging, goals)
      'articular_cartilage',  // ← Articular cartilage (grade, location, treatment, ICRS, chondral)
      'return_to_play_protocol',  // ← Return to play protocol (stages, tests, clearance criteria, restrictions)
      'athletic_injury_assessment',  // ← Athletic injury assessment (mechanism, severity, special tests, sideline)
      'sports_nutrition_plan',  // ← Sports nutrition plan (macros, calories, supplements, hydration)
      'overtraining_assessment',  // ← Overtraining assessment (heart rate, training load, fatigue, cortisol)
      'sports_physical_examination', // ← Sports physical examination (clearance, cardiac auscultation, musculoskeletal, functional movement screen)
      'extended_family_history', // ← Extended family history (grandparents, aunts/uncles, cousins, disease histories, genetic counseling)
      'genetics_psychosocial_assessment', // ← Genetics psychosocial assessment (emotional response, coping, family support, cultural beliefs, reproductive intentions)
      'chemotherapy_regimen', // ← Chemotherapy regimen (regimen name, intent, drugs, cycle length, premedications, growth factor support)
      'chemotherapy_records', // ← Chemotherapy records (regimen, cycle, day, medications, toxicities, response)
      'radiation_therapy', // ← Radiation therapy (site, dose, fractions, technique, planning, side effects, concurrent chemo)
      'radiation_therapy_records', // ← Radiation therapy treatment records
      'clinical_trials', // ← Clinical trials (eligibility, enrollment, trials offered, screening status)
      'clinical_trial_documents', // ← Clinical trial documents (trial details, protocols, visit schedules, adverse events, outcomes)
      'palliative_care_needs', // ← Palliative care needs (symptoms addressed, pain assessment, psychosocial support, spiritual care, hospice discussion, quality of life)
      'palliative_care', // ← Palliative care (goals of care, symptom management, advance directives, hospice discussion, quality of life)
      'psychosocial_oncology', // ← Psychosocial oncology (distress screening, anxiety, depression, coping strategies, support systems, financial toxicity, return to work)
      'prognostic_factors', // ← Prognostic factors (favorable factors, adverse factors, survival estimates, recurrence risk, prognostic scores, molecular subtype)
      'supportive_care', // ← Supportive care (anti-seizure, steroids, PCP prophylaxis, anti-emetics, supportive medications for cancer treatment)
      'icu_flow_sheets', // ← ICU flow sheets (hourly vitals, neurologic, respiratory, hemodynamic, fluids, labs, sedation, pain, interventions)
      'procedures_interventions', // ← Procedures interventions (clinical status, vital signs, interventions, response, plan, recommendations)
      'wound_care_assessments', // ← Wound care assessments (wound identification, classification, measurements, wound bed, exudate, infection, vascular, debridement, dressings, healing progress)
      'pressure_ulcer_risk', // ← Pressure ulcer risk (mapped to WoundCareAssessments template via pattern match)
      'physical_therapy_evaluations', // ← Physical therapy evaluations (ROM, strength, balance, gait, pain, functional goals, treatment plan, precautions)
      'occupational_therapy_reports', // ← Occupational therapy reports (ADL, cognitive, sensory, fine motor, adaptive equipment, home mods, treatment plan, goals)
      'speech_therapy_assessments', // ← Speech therapy assessments (communication, swallowing, cognitive language, voice, treatment plan, goals)
      'functional_status', // ← Functional status (ADL, IADL, mobility aids, findings, assessment, notes)
      'stroke_assessment', // ← Stroke assessment (type, territory, thrombolysis, deficits, secondary prevention, findings, assessment)
      'pmr_assessment', // ← PMR assessment (functional history, functional assessment, therapy interventions, equipment, spasticity, discharge planning)
      'assistive_devices',  // ← Assistive devices (AFO, mobility aids, orthotics, prosthetics, prescribed equipment)
      'durable_medical_equipment_orders',  // ← DME orders (equipment type, HCPCS, medical necessity, prior auth, supplier)
      'inflammatory_markers',  // ← Inflammatory markers (ESR, CRP, ferritin, complement, immunoglobulins, findings, assessment)
      'lifestyle_risk_assessment',  // ← Lifestyle risk assessment (smoking, alcohol, physical activity, BMI, diet, sleep, stress, risk scores)
      'biopsychosocial_formulation',  // ← Biopsychosocial formulation (biological, psychological, social factors, strengths, vulnerabilities)
      'psychiatric_assessment_scales',  // ← Psychiatric assessment scales (PHQ-9, GAD-7, PHQ-15, MDQ, PCL-5, AUDIT, MMSE, MoCA)
      'safety_planning',  // ← Safety planning (risk assessment, warning signs, coping strategies, safety measures)
      'physical_therapy_notes', // ← Physical therapy notes (KPS, ECOG, ADL, IADL performance scores, findings, assessment, plan, recommendations)
      'intake_output_records', // ← Intake/output records (fluid balance, intake, output, urine output, IV fluids, drains, NGT)
      'medication_administration_records', // ← Medication administration records (pre-hospital, current infusions, scheduled, PRN, pending meds, pain, sedation)
      'scheduled_medications', // ← Scheduled medications (name, generic name, dosage, frequency, route, prescriber, indication, instructions, duration, safety)
      'nursing_assessments', // ← Nursing assessments (vital signs, patient status, care plan, monitoring, assessment, plan, notes)
      'wound_care_documentation', // ← Wound care documentation (wound location, type, stage, bed, treatment, dressings)
      'wound_care_notes', // ← Wound care notes (wound location, type, dimensions, bed, edges, periwound skin, infection signs, treatment, dressings)
      'emergency_information', // ← Emergency information (emergency contacts, warning criteria, when to call, assessment, plan)
      'emergency_discharge_summaries', // ← Emergency discharge summaries (chief complaint, vital signs, diagnoses, procedures, labs, imaging, medications, follow-up)
      'emergency_reports', // ← Emergency reports (report date, report type, clinical indication, findings, urgency, recommendations, follow-up)
      'emergency_assessment', // ← Emergency assessment (triage level, arrival mode, primary survey, resuscitation, disposition, findings, assessment, plan)
      'emergency_airway_management', // ← Emergency airway management (airway assessment, intubation details, equipment, medications, complications, post-procedure)
      'orthodontic_treatment_plans', // ← Orthodontic treatment plans (short-term goals, long-term goals, pending procedures, immediate interventions, rehabilitation referrals, provider)
      'periodontal_charts', // ← Periodontal charts (diagnosis, stage, grade, pocket depths, clinical attachment level, bleeding on probing, recession, mobility, furcation, bone loss, calculus, gingivitis, plaque)
      'admission_recommendations', // ← Admission recommendations (report date, report type, clinical indication, findings, urgency, recommendations, follow-up)
      'triage_data', // ← Triage data (arrival time, chief complaint, triage vitals, triage assessment, findings, assessment, plan, status)
      'tropical_disease_assessment', // ← Tropical disease assessment (travel history, vector exposure, fever pattern, parasitology, serology, complications, public health)
      'ed_course', // ← ED course (event, details, findings, assessment, plan, recommendations, notes)
      'ed_disposition', // ← ED disposition (decision, admitting service/attending, bed request/assigned, transfer time, follow-up required)
      'discharge_planning', // ← Discharge planning (expected LOS, destination, follow-up, activity restrictions, warning signs, recommendations)
      'rehabilitation_protocol', // ← Rehabilitation protocol (phases with exercises, restrictions, milestones, brace/CPM protocols, findings, assessment, plan)
      'respiratory_devices', // ← Respiratory devices (ventilators, CPAP/BiPAP, nebulizers, oxygen concentrators, findings, assessment, plan, notes)
      'cpap_management',  // ← CPAP management (pressure settings, compliance, AHI, mask type/size/brand, side effects, Epworth score)
      'cpap_bipap_management',  // ← CPAP/BiPAP management (device type, pressure settings, AHI, mask type, compliance, leak rate, ventilation, titration)
      'ventilator_settings', // ← Ventilator settings (mode, tidal volume, respiratory rate, PEEP, FiO2, findings, assessment, plan, notes)
      'hospital_admission_notes', // ← Hospital admission notes (admission date/time, source, diagnosis, chief complaint, HPI, vital signs, orders, condition, recommendations)
      'hospital_transfer_notes', // ← Hospital transfer notes (assessment date/time, clinical status, vitals, interventions, response, plan)
      'admission_assessments', // ← Admission assessments (assessment date/time, clinical status, vitals, interventions, response, plan, recommendations)
      'second_opinion_reports', // ← Second opinion reports (diagnosis, clinical measures, imaging/pathology, recommendations)
      'readmission_risk_assessment', // ← Readmission risk assessment (LACE/HOSPITAL scores, utilization, medication risk, social/mitigation)
      'myositis_assessment', // ← Myositis assessment (muscle weakness, skin manifestations, muscle enzymes, antibodies, EMG, biopsy)
      'polycystic_kidney_disease', // ← Polycystic kidney disease (ADPKD: TKV, Mayo class, cysts, extrarenal manifestations, genetics, labs)
      'travel_medicine_assessment', // ← Travel medicine assessment (destinations, vaccines, prophylaxis, risk assessment)
      'travel_health_certificates', // ← Travel health certificates (vaccination dates, certificate details, prophylaxis)
      'health_coaching_notes', // ← Health coaching notes (goals, behavior change, metrics, barriers, action plan)
      'ibd_biomarkers', // ← IBD biomarkers (fecal calprotectin/lactoferrin, CRP, ESR, albumin, hemoglobin, serologies)
      'respiratory_infections', // ← Respiratory infections (current infection, recurrent infections, pneumonia history, immunizations, TB risk)
      'transfer_summaries', // ← Transfer summaries (report date/type, clinical indication, findings, urgency, follow-up, recommendations)
      'hospice_notes', // ← Hospice notes (eligibility criteria, level of care, services provided, recommendations, comfort kit medications)
      'mortality_risk_assessment', // ← Mortality risk assessment (risk scores, organ support, risk factors, predicted mortality)
      'pressure_ulcer_risk', // ← Pressure ulcer risk (Braden scale, ulcer status, risk factors)
      'palliative_care', // ← Palliative care (goals of care, advance directives, hospice discussion, findings)
      'tumor_board_notes', // ← Tumor board notes (meeting info, findings, assessment, plan, recommendations, notes)
      'cardiac_catheterization_reports', // ← Cardiac catheterization reports (indication, access site, findings, coronary anatomy, hemodynamics, interventions, complications, recommendations)
      'cardiology_assessment', // ← Cardiology assessments (echo, ECG, cath, stress test, risk factors, scheduled procedures, recommendations)
      'cardiac_monitoring', // ← Cardiac monitoring (troponin trending, ECG changes, rhythm monitoring, results)
      'cardiac_device_interrogations', // ← Cardiac device interrogations (pacemaker, ICD, CRT, loop recorder - battery, leads, pacing, arrhythmias, therapy)
      'proposed_art_switch', // ← Proposed ART switch (antiretroviral therapy changes, drug resistance, regimen optimization, HBV-active medications)
      'hiv_history', // ← HIV history (diagnosis date, diagnosis context, transmission route, CD4 history, genotype resistance, prior OIs, ART history)
  'hiv_pep_prophylaxis',
      'shift_handoff_notes',  // ← Shift handoff notes (acuity, APACHE II, SOFA, GCS, vitals, medications, ventilation, labs, care planning)
      'hiv_prep_management', // ← HIV PrEP management (PrEP indication, baseline HIV testing, baseline labs, adherence, quarterly monitoring, CAB-LA injections)
      'immune_reconstitution_planning', // ← Immune reconstitution planning (IRIS monitoring, CD4 monitoring, prophylaxis discontinuation, assessment, plan)
      'primary_prophylaxis', // ← Primary prophylaxis (infection prevention, CD4 thresholds, TMP-SMX, prophylactic medications, opportunistic infections)
      'secondary_prophylaxis', // ← Secondary prophylaxis (post-infection prevention, maintenance prophylaxis, discontinuation criteria, PCP, toxoplasmosis)
      'opportunistic_infections', // ← Opportunistic infections (OIs, AIDS-defining illnesses, CD4 count, prophylaxis, antimicrobial therapy)
      'cmv_monitoring_plan', // ← CMV monitoring plan (cytomegalovirus, viral load, PCR monitoring, prophylaxis, ganciclovir, immunosuppression)
      'peripheral_neuropathy', // ← Peripheral neuropathy (nerve damage, sensory symptoms, motor symptoms, treatment, etiology, neuropathic pain)
      'cardiac_rehabilitation_reports', // ← Cardiac rehabilitation reports (program type, findings, goals, recommendations, progress, follow-up)
      'immediate_interventions', // ← Immediate interventions (acute management, emergency protocols, ACS management, medications, recommendations)
      'goals_of_care_discussions', // ← Goals of care discussions (code status conversations, family meetings, ICU discussions)
      'advance_directives', // ← Advance directives (documentType, treatment preferences, healthcare proxy, specific instructions)
      'home_safety', // ← Home safety (fall risk, home modifications, functional status, sensory, medication safety, cognitive, nutritional, social support)
      'fall_prevention_education', // ← Fall prevention education (assessment scores, clinical findings, medications, gait, home hazards, exercise, footwear, education topics)
      'cognitive_screening', // ← Cognitive screening (MMSE/MoCA domain scores, informant info, clinical assessment, behavioral disturbances)
      'research_consent_forms', // ← Research consent forms (informed consent, clinical trial enrollment, signatures)
      'performance_status', // ← Performance status (ECOG, Karnofsky, Lansky, functional capacity, clinical trial eligibility)
      'response_assessment', // ← Response assessment (RECIST, RANO, treatment response, tumor response, progression-free survival)
      'quality_metrics', // ← Quality metrics (performance metrics, targets, actuals, variance, barriers, improvement plans, action items)
      'colonoscopy_reports', // ← Colonoscopy reports (GI endoscopy, Mayo score, extent, findings, pathology, assessment, plan, recommendations)
      'extraintestinal_manifestations', // ← Extraintestinal manifestations (IBD, articular, dermatologic, ocular, hepatobiliary, renal, pulmonary, hematologic)
      'facility',  // ← Facility (facility name, NPI, type, accreditation, bed capacity, ICU, ER, trauma, specialty services, designations)
      'ibd_surgical_planning', // ← IBD surgical planning (surgery type, urgency, pouch option, indications, risks, patient preference, staging)
      'bone_health', // ← Bone health (DEXA scan, bone protection therapy, risk factors, fractures, recommendations)
      'compression_therapy', // ← Compression therapy (garment type, vascular assessment, edema, lymphedema, adverse reactions)
      'closure_technique', // ← Closure technique (procedure name, closure layer, suture type/material/size, port site closure, skin closure)
      'cancer_related_side_effects', // ← Cancer related side effects (lymphedema, neuropathy, fatigue, cognitive changes, sexual dysfunction)
      'bone_scan_reports', // ← Bone scan reports (nuclear medicine bone scan, skeletal scintigraphy, metabolic bone disease, fractures)
      'pet_scan_reports', // ← PET scan reports (PET/CT, SUV values, staging, lymph nodes, metastatic sites, radiopharmaceutical)
      'thoracic_surgery_assessment', // ← Thoracic surgery assessment (lung resection, lobectomy, VATS, PFTs, tumor staging, adjuvant therapy)
      'cystoscopy_reports', // ← Cystoscopy reports (bladder assessment, urethral findings, biopsy, ureteric orifices)
      'urodynamic_studies', // ← Urodynamic studies (filling/voiding cystometry, flow rates, detrusor assessment, incontinence)
      'urology_consultations', // ← Urology consultations (chief complaint, prostate, renal, stones, urodynamics, cystoscopy, sexual function)
      'nuclear_medicine_assessment', // ← Nuclear medicine assessment (PET scan, bone scan, thyroid scan, parathyroid SPECT, cardiac perfusion with LVEF/ischemia/TID bar charts)
      'nuclear_medicine_studies', // ← Nuclear medicine studies (thyroid scan, uptake, radiopharmaceutical, nodule analysis)
      'endocrinology_assessment', // ← Endocrinology assessment (thyroid function, parathyroid, adrenal, metabolic panel)
      'ergonomic_assessment', // ← Ergonomic assessment (workstation, RULA, REBA, body regions, physical demands, compliance)
      'colorectal_surgery_assessment', // ← Colorectal surgery assessment (colonoscopy, anorectal manometry, defecography, stoma assessment, oncologic markers)
      'nutritional_assessment', // ← Nutritional assessment (diet type, weight status, dietary restrictions, supplements, feeding difficulties)
      'psc_management', // ← PSC Management (Primary Sclerosing Cholangitis - ursodeoxycholic acid, MRCP, strictures, hepatology management)
      'continuous_infusions', // ← Continuous Infusions (ICU/Critical Care - vasopressors, sedation, insulin drip, vital signs, interventions, response)
      'sepsis_management', // ← Sepsis Management (severity, qSOFA/SOFA, cultures, antibiotics, vasopressors, organ dysfunction, bundle compliance)
      'concussion_assessment', // ← Concussion Assessment (GCS, SCAT5, cognitive testing, balance, symptoms, return to play)
      'ems_run_reports', // ← EMS Run Reports (vital signs, GCS, mechanism of injury, airway, transport, disposition)
      'glasgow_coma_scale', // ← Glasgow Coma Scale (Neurological Assessment - GCS score, eye opening, verbal response, motor response, clinical status, interventions)
      'medical_procedures', // ← Medical procedures (procedure name, date, description, provider, findings)
      'consultation_timeline', // ← Consultation timeline (events, consultations, procedures, timeline of care)
      'injury_details', // ← Injury details (mechanism, location, severity, circumstances)
      'occupational_medicine_evaluations', // ← Occupational medicine evaluations (FCE, work restrictions, functional capacity, accommodations)
      'occupational_health_assessment', // ← Occupational health assessment (fit for duty, work hazards, physical demands, PPE, restrictions)
      'workers_compensation_evaluation', // ← Workers' compensation evaluation (claim, apportionment, impairment, causality, work status)
      'workplace_injury_report', // ← Workplace injury report (OSHA recordable, lost work days, restricted duty, body parts affected, injury mechanism)
      'return_to_work_plan', // ← Return to work plan (RTW, modified duty, work restrictions, accommodations, recovery timeline)
      'work_restrictions', // ← Work restrictions (activity limitations, return to work, accommodations)
      'pain_management', // ← Pain management (pain assessment, medications, interventions, goals)
      'advance_care_planning', // ← Advance care planning (goals of care, code status, treatment preferences, healthcare agent)
      'coagulation_studies', // ← Coagulation studies (PT, INR, PTT, fibrinogen, D-dimer, bleeding time)
      'social_history', // ← Social history (tobacco, alcohol, substance use, living situation, occupation, social support)
      // Anesthesia & Pain Management
      'airway_management_records', // ← Airway management records (intubation, extubation, airway devices, confirmation methods)
      'regional_anesthesia_records', // ← Regional anesthesia records (nerve blocks, epidural, spinal anesthesia, catheter placement)
      'procedural_sedation',  // ← Procedural sedation (indication, medications, monitoring, findings, assessment, recovery)
      'sedation_records', // ← Sedation records (procedure, sedation level, medications, RASS scores, vitals, adverse events, recovery, providers)
      'chronic_pain_assessment', // ← Chronic pain assessment (pain scales, pain scores, functional impact, quality of life)
      'scleroderma_assessment', // ← Scleroderma assessment (skin involvement, organ involvement, Raynaud's, disease activity)
      'sjogrens_syndrome_assessment', // ← Sjogrens syndrome assessment (sicca symptoms, salivary biopsy, systemic manifestations, ESSDAI/ESSPRI)
      'vasculitis_assessment', // ← Vasculitis assessment (BVAS score, organ systems, biopsy, angiographic findings)
      'autopsy_reports', // ← Autopsy reports (cause of death, manner of death, organ examination, toxicology, microscopic findings)
      'toxicology_reports', // ← Toxicology reports (substances detected, concentration levels, forensic implications, chain of custody)
      'poison_control_reports',  // ← Poison control reports (substance, dose, antidote, serum levels, hepatic/renal function, disposition)
      'blood_sample_collection_status',  // ← Blood sample collection (phlebotomy, tube types, venipuncture, sample quality, tracking)
      'rheumatoid_arthritis_assessment', // ← Rheumatoid arthritis (DAS28, functional status, radiographic progression, treatment plan)
      'advance_directive_discussion',    // ← Advance directive discussion (participants, topics, code status, healthcare proxy, preferences)
      'adult_day_program_info',          // ← Adult day program (program details, schedule, services, transportation, cost)
      'nutritional_status',              // ← Nutritional status (MUST/NUTRIC scores, labs, anthropometrics, intake adequacy)
      'operative_time',                  // ← Operative time (anesthesia/surgical times, specialized times, surgical team, blood loss)
      'vascular_surgery_assessment',     // ← Vascular surgery (ABI/TBI/TcPO2, pulse exam, duplex ultrasound, wound healing, limb salvage)
      'job_hazard_analysis',             // ← Job hazard analysis (task steps, hazards, risk levels, exposures, controls, PPE, training)
      'vascular_bypass_surgery',         // ← Vascular bypass surgery (graft details, hemodynamics, operative details, anticoagulation)
      'venous_insufficiency_assessment', // ← Venous insufficiency (CEAP, reflux, junction competence, vein measurements, skin findings)
      'aortic_aneurysm_surveillance',    // ← Aortic aneurysm surveillance (diameter, growth rate, thrombus, surveillance plan)
      'trauma_flow_sheets',              // ← Trauma flow sheets (trauma scores, vitals, primary survey, resuscitation, labs)
      'trauma_assessment',               // ← Trauma assessment (triage, ABCDE survey, injuries, interventions, disposition)
      'trauma_scoring',                  // ← Trauma scoring (GCS components, ISS/RTS/TRISS, AIS scores, clinical flags)
      'emergency_procedures',            // ← Emergency procedures (procedure details, team, timing, technique, outcome)
      'immunization_schedule',           // ← Immunization schedule (vaccine details, administration, codes, consent, series)
      'travel_vaccination_records',      // ← Travel vaccinations (trip details, vaccine, immunity, yellow card, prophylaxis)
      'facial_trauma_assessment',        // ← Facial trauma (fractures, ocular findings, nerve/soft tissue, dental, critical findings)
      'immediate_recommendations',       // ← Immediate recommendations (urgency flags, protocol activations, ABC support, critical values, med discontinuation, monitoring)
      'immunization_record',             // ← Immunization record (vaccine history, given today, due/catch-up, contraindications, clinical notes)
      'iv_infusions',                    // ← IV infusions (infusion details, access, safety/reactions, monitoring, nursing education)
      'venous_thromboembolism_risk',     // ← VTE risk (Caprini/Wells/Padua scores, risk factors, contraindications, prophylaxis plan)
      'performance_assessment',          // ← Sports performance assessment (metrics, isokinetic strength, limitations, return-to-play)
      'treatment_goals',                 // ← Treatment goals (immediate/short/long-term structured goals, patient & family goals)
      'document_type',                   // ← Document classification (subtype, ICD-10/CPT codes, quality compliance)
      'dnr_orders', // ← DNR orders (code status, resuscitation preferences, advance directives, healthcare proxy)
      'case_summaries', // ← Case summaries (clinical case summary, diagnoses, medications, procedures, disposition)
      'resuscitation_records', // ← Resuscitation records (arrest info, CPR, medications, airway, outcome, ROSC)
      'glomerular_disease', // ← Glomerular disease (diagnosis, biopsy findings, serologies, immunosuppression, assessment, plan)
      'code_blue_summaries', // ← Code blue summaries (cardiac arrest, CPR, defibrillation, medications, ROSC, outcome)
      'rapid_response_summaries', // ← Rapid response summaries (vitals, interventions, scoring, disposition)
      'epilepsy_assessment', // ← Epilepsy assessment (seizure types, AEDs, EEG findings, assessment, plan)
      'headache_assessment', // ← Headache assessment (headache type, triggers, therapies, MIDAS score, assessment, plan)
      'day_programs', // ← Day programs (ICD-10 codes, vital signs, ASA status, medications, schedule, follow-up, discharge)
      'patient_visits',  // ← Patient visit records with SOAP notes, transcripts, and AI summaries
      'partner_notification',  // ← Partner notification (index case, notifiable condition, exposure window, PEP/PrEP, serology, DIS, cluster investigation)
      'sti_screening_panel',  // ← STI screening panel (HIV, syphilis, chlamydia, gonorrhea, hepatitis B/C, HSV, HPV, trichomonas, PrEP eligibility)
      'sexual_health_counseling',  // ← Sexual health counseling (session type, identity, STI screening, PrEP, FSFI, IIEF, SDS, contraception, goals, referrals)
    ];
  const navigateToDocuments = (category) => {
    // category is now a full object with { name, displayName, displayMode, ... }
    console.log('[ArtifactPanel] ===== navigateToDocuments START =====');
    console.log('[ArtifactPanel] Category object:', JSON.stringify(category, null, 2));
    console.log('[ArtifactPanel] Category.displayMode:', category?.displayMode);
    console.log('[ArtifactPanel] Category.name:', category?.name);
    console.log('[ArtifactPanel] Is in DOCUMENT_VIEW_COLLECTIONS:', DOCUMENT_VIEW_COLLECTIONS.includes(category?.name));
    console.log('[ArtifactPanel] Current selectedCategory:', state.selectedCategory);

    // Check if user is clicking the same collection that's already being viewed
    const isSameCollection = category.name === state.selectedCategory;
    console.log('[ArtifactPanel] isSameCollection:', isSameCollection, '(' + category.name + ' === ' + state.selectedCategory + ')');

    // CRITICAL FIX: Set flag to skip main useEffect processing
    // This prevents external prop changes from overriding this internal navigation
    console.log('[ArtifactPanel] Setting isInternalNavigationRef = true to prevent useEffect override');
    isInternalNavigationRef.current = true;

    // Dispatch event to notify CategoryListView that navigation happened
    window.dispatchEvent(new CustomEvent('artifactPanelNavigated', { detail: { category: category.name } }));

    // Route based on display mode (displayMode from backend takes precedence)
    if (category.displayMode === 'document' || DOCUMENT_VIEW_COLLECTIONS.includes(category.name)) {
      // Document view collections - show aggregate document view (merged into single template)
      console.log('[ArtifactPanel] ✅ Routing to document-collection view (displayMode or DOCUMENT_VIEW_COLLECTIONS)');

      // If clicking same collection, force refresh by clearing gridData
      if (isSameCollection) {
        console.log('[ArtifactPanel] ⚠️ Same collection clicked - clearing cached data to force refresh');
      }

      fetchAndShowDocument(category);
    } else if (category.displayMode === 'grid') {
      // Grid mode - show all data in table
      console.log('[ArtifactPanel] Routing to grid view');
      setState(prev => ({
        ...prev,
        level: 'grid',
        selectedCategory: category.name,
        selectedCategoryData: category,
        selectedDocument: null,
        documentId: null,
        // CRITICAL: Always clear gridData when navigating to a new collection (even if same collection name)
        // This ensures fresh data fetch
        gridData: null
        // Keep: categoriesData, hasMultipleCategoriesRoot
      }));
      // Update localStorage directly
      localStorage.setItem('artifactLevel', 'grid');
      localStorage.setItem('artifactCategory', category.name);
      localStorage.removeItem('artifactDocumentId');
    } else {
      // Regular collections - show document list
      console.log('[ArtifactPanel] Routing to documents list view');
      setState(prev => ({
        ...prev,
        level: 'documents',
        selectedCategory: category.name,
        selectedCategoryData: category,
        selectedDocument: null,
        documentId: null,
        // CRITICAL: Always clear gridData when navigating to a new collection (even if same collection name)
        // This ensures fresh data fetch
        gridData: null
        // Keep: categoriesData, hasMultipleCategoriesRoot
      }));
      // Update localStorage directly
      localStorage.setItem('artifactLevel', 'documents');
      localStorage.setItem('artifactCategory', category.name);
      localStorage.removeItem('artifactDocumentId');
    }
  };

  // Fetch document data and show in document view
  const fetchAndShowDocument = async (category) => {
    // For document mode, we'll show the collection data directly
    // Set to a special 'document-collection' level
    // CRITICAL: Preserve categoriesData and hasMultipleCategoriesRoot so back button works
    setState(prev => ({
      ...prev,
      level: 'document-collection',
      selectedCategory: category.name,
      selectedCategoryData: category,
      selectedDocument: null,
      documentId: null,
      // CRITICAL: Always clear gridData when navigating to a new collection
      // This ensures fresh data fetch from CollectionDocumentView
      gridData: null
      // Keep: categoriesData, hasMultipleCategoriesRoot from prev state
    }));
    // Update localStorage directly
    localStorage.setItem('artifactLevel', 'document-collection');
    localStorage.setItem('artifactCategory', category.name);
    localStorage.removeItem('artifactDocumentId');
  };

  const navigateToDetail = (document) => {
    console.log('[ArtifactPanel] navigateToDetail called with document:', {
      id: document._id,
      hasTitle: !!document.title,
      hasDate: !!document.date,
      keys: Object.keys(document)
    });

    setState(prev => {
      const newState = {
        ...prev,
        level: 'detail',
        documentId: document._id,
        selectedDocument: document  // Store full document to avoid API fetch
      };

      console.log('[ArtifactPanel] navigateToDetail setting state:', {
        selectedCategory: newState.selectedCategory,
        hasSelectedDocument: !!newState.selectedDocument,
        documentId: newState.documentId
      });

      return newState;
    });

    // CRITICAL FIX: Update localStorage DIRECTLY without calling onNavigate
    // This prevents ChatContainer state updates that trigger useEffect
    localStorage.setItem('artifactLevel', 'detail');
    localStorage.setItem('artifactDocumentId', document._id);
    console.log('[ArtifactPanel] Updated localStorage directly (no onNavigate call)');
  };

  const navigateBackToDocuments = () => {
    // MULTI-COLLECTION SUPPORT: If we came from multi-selector, go back there
    if (state.cameFromMultiSelector && state.gridData?.artifactPanels) {
      console.log('🔙 [ArtifactPanel] Navigating back to multi-collection selector');
      setState({
        ...state,
        level: 'collection-selector',
        selectedCategory: null,
        selectedDocument: null,
        documentId: null,
        cameFromMultiSelector: false  // Reset the flag
      });
      // Update localStorage
      localStorage.setItem('artifactLevel', 'collection-selector');
      localStorage.removeItem('artifactCategory');
      localStorage.removeItem('artifactDocumentId');
      return;
    }

    // Standard flow: Back to documents list within the same category
    setState({
      ...state,
      level: 'documents',
      selectedDocument: null,
      documentId: null
    });
    // Update localStorage directly without calling onNavigate
    localStorage.setItem('artifactLevel', 'documents');
    localStorage.removeItem('artifactDocumentId');
    console.log('[ArtifactPanel] Navigated back to documents, updated localStorage directly');
  };

  // Close handler - Just hide the panel, don't clear state
  // State is only cleared on "new chat" in ChatContainer
  const handleClose = () => {
    onClose();  // This just sets artifactPanelOpen=false, keeps all data
  };

  console.log('🎨 [ArtifactPanel] Rendering with state:', {
    level: state.level,
    selectedCategory: state.selectedCategory,
    documentId: state.documentId,
    hasSelectedDocument: !!state.selectedDocument,
    selectedDocumentKeys: state.selectedDocument ? Object.keys(state.selectedDocument).slice(0, 5) : null,
    hasGridData: !!state.gridData,
    hasCategoriesData: !!state.categoriesData,
    categoriesDataLength: state.categoriesData?.length,
    hasMultipleCategoriesRoot: state.hasMultipleCategoriesRoot
  });

  return (
    <div className={`artifact-panel ${isOpen ? 'open' : 'closed'}`}>
      {/* Close button - Always visible at top right */}
      <button
        className="artifact-close-button"
        onClick={handleClose}
        aria-label="Close"
        title="Close Medical Data Panel"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '40px',
          height: '40px',
          background: '#0E1626',
          color: '#E9EFFA',
          fontSize: '20px',
          fontWeight: '600',
          borderRadius: '8px',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.2s ease',
          border: '1px solid #28395C'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.background = '#1B2C4A';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = '#0E1626';
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Content area - render appropriate view based on level */}
      <div className="artifact-content">
        {state.level === 'categories' && (
          <CategoryListView
            patientId={patientId}
            onSelectCategory={navigateToDocuments}
            initialCategories={state.categoriesData}
            onSendMessage={onSendMessage}
            patientName={patientName}
          />
        )}

        {/* MULTI-COLLECTION SUPPORT: Show collection selector when agent returned multiple collections */}
        {state.level === 'collection-selector' && state.gridData?.artifactPanels && (
          <CollectionSelectorView
            artifactPanels={state.gridData.artifactPanels}
            patientName={patientName}
            onSelectCollection={(panel) => {
              console.log('🎯 [ArtifactPanel] Collection selected from multi-selector:', panel.category);
              // IMPROVED FLOW: Go directly to detail view, skip documents list
              // The panel.data should contain the document(s) for this category

              // Extract the document data from the panel
              let documentData = panel.data;

              // Handle wrapped data structure (data might be the collection array)
              if (Array.isArray(documentData)) {
                // If it's an array, wrap it as a document with the category as key
                documentData = {
                  _id: `${panel.category}_${panel.patientId}_all`,
                  [panel.category]: documentData,
                  patientId: panel.patientId,
                  category: panel.category,
                  patientName: patientName
                };
              } else if (documentData && documentData[panel.category]) {
                // Already has the category key - good
                documentData = {
                  ...documentData,
                  _id: documentData._id || `${panel.category}_${panel.patientId}_all`,
                  patientId: panel.patientId,
                  category: panel.category,
                  patientName: patientName
                };
              }

              console.log('🎯 [ArtifactPanel] Navigating directly to detail with document:', {
                category: panel.category,
                hasData: !!documentData,
                dataKeys: documentData ? Object.keys(documentData) : []
              });

              // Navigate directly to detail view, preserving the multi-selector data for back navigation
              isInternalNavigationRef.current = true;
              setState({
                ...state,
                level: 'detail',
                selectedCategory: panel.category,
                selectedDocument: documentData,
                documentId: documentData?._id || `${panel.category}_${panel.patientId}_all`,
                // CRITICAL: Store flag that we came from multi-collection selector
                cameFromMultiSelector: true,
                // Keep the artifactPanels in gridData for back navigation
                gridData: {
                  ...state.gridData,
                  artifactPanels: state.gridData.artifactPanels
                }
              });
            }}
          />
        )}

        {state.level === 'direct-grid' && state.gridData && (
          <DirectGridView
            title={state.gridData.title}
            data={state.gridData.data}
            columns={state.gridData.columns}
            headers={state.gridData.headers}
          />
        )}

        {state.level === 'grid' && state.selectedCategory && (
          <GridCollectionView
            patientId={patientId}
            category={state.selectedCategory}
            categoryDisplay={state.selectedCategoryData?.displayName}
            onBack={navigateToCategories}
          />
        )}

        {state.level === 'document-collection' && state.selectedCategory && (
          <CollectionDocumentView
            patientId={patientId}
            category={state.selectedCategory}
            categoryDisplay={state.selectedCategoryData?.displayName}
            onBack={navigateToCategories}
            hasCategoriesList={state.hasMultipleCategoriesRoot}
            onDataFetched={(documents) => {
              // Notify ChatContainer when documents are fetched
              if (onDataFetched) {
                onDataFetched(documents, state.selectedCategory);
              }
            }}
          />
        )}

        {state.level === 'documents' && state.selectedCategory && (
          <DocumentListView
            patientId={patientId}
            category={state.selectedCategory}
            initialDocuments={state.gridData?.data || null}
            onSelectDocument={navigateToDetail}
            onBack={() => {
              // CRITICAL: Check if we have full categories list (came from categories view)
              if (state.fullCategoriesList && state.fullCategoriesList.length > 1) {
                // We came from full categories list - go back to it
                console.log('🔙 [DocumentListView] Going back to full categories list');
                navigateToCategories();
              } else if (state.hasMultipleCategoriesRoot || state.categoriesData) {
                // We have categories data (even if just 1) - go back to categories
                console.log('🔙 [DocumentListView] Going back to categories list');
                navigateToCategories();
              } else if (initialCategory && initialLevel === 'documents') {
                // Started with a specific category from direct command - close panel
                console.log('🔙 [DocumentListView] Closing panel (direct command)');
                handleClose();
              } else {
                // Default: try to go to categories
                console.log('🔙 [DocumentListView] Default: navigating to categories');
                navigateToCategories();
              }
            }}
          />
        )}

        {state.level === 'detail' && state.selectedCategory && (state.documentId || state.selectedDocument) && (
          <DocumentDetailView
            patientId={patientId}
            category={state.selectedCategory}
            documentId={state.documentId}
            documentData={state.selectedDocument}  // Pass the full document from documents list
            onBack={navigateBackToDocuments}
          />
        )}
      </div>
    </div>
  );
};

export default ArtifactPanel;
