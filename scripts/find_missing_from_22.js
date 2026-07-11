const fs = require('fs');

// The 22 new patients from import CSV
const new22Patients = [
  { name: "Patricia Anderson", pdf: "pulmonology_asthma_action_plan.pdf" },
  { name: "Marcus Johnson", pdf: "biologic_therapy_dupilumab.pdf" },
  { name: "Elena Rodriguez", pdf: "clinical_risk_scores_comprehensive.pdf" },
  { name: "Tyrone Washington", pdf: "barriers_to_care_housing_financial.pdf" },
  { name: "Samantha Lee", pdf: "medication_access_patient_assistance.pdf" },
  { name: "Derek Thompson", pdf: "cardiac_catheterization_stemi_protocol.pdf" },
  { name: "Vanessa Martinez", pdf: "stemi_acs_gdmt_tracking.pdf" },
  { name: "Raymond Foster", pdf: "neurosurgery_awake_craniotomy_planning.pdf" },
  { name: "Gloria Hernandez", pdf: "brain_tumor_molecular_idh_mgmt.pdf" },
  { name: "Kenneth Davis", pdf: "pulmonary_function_test_comprehensive.pdf" },
  { name: "Diane Wilson", pdf: "cardiac_rehabilitation_enrollment.pdf" },
  { name: "Jerome Jackson", pdf: "neuropsychological_testing_post_surgery.pdf" },
  { name: "Angela Thomas", pdf: "discharge_planning_post_cardiac_surgery.pdf" },
  { name: "Vincent Moore", pdf: "cardiac_biomarker_troponin_trending.pdf" },
  { name: "Brenda Taylor", pdf: "quality_metrics_door_to_balloon_time.pdf" },
  { name: "Terrence Anderson", pdf: "environmental_modifications_mold_remediation.pdf" },
  { name: "Monica Clark", pdf: "clinical_trial_enrollment_idh_inhibitor.pdf" },
  { name: "Gregory Lewis", pdf: "functional_status_karnofsky_assessment.pdf" },
  { name: "Sharon Walker", pdf: "implantable_cardiac_device_icd_evaluation.pdf" },
  { name: "Russell Hall", pdf: "anticoagulation_management_afib_doac.pdf" },
  { name: "Tiffany Young", pdf: "advanced_imaging_fmri_dti_tractography.pdf" },
  { name: "Carlos King", pdf: "genetic_testing_brca_counseling.pdf" }
];

// Current CSV
const currentCsv = fs.readFileSync('/home/erangross/Documents/patinets.csv', 'utf-8');
const currentLines = currentCsv.split('\n').filter(line => line.trim());

const currentPatients = currentLines.map(line => {
  const parts = line.split(',');
  return `${parts[0]} ${parts[1]}`;
});

console.log('Checking which of the 22 new patients is missing from CSV:\n');

new22Patients.forEach((patient, idx) => {
  const found = currentPatients.includes(patient.name);
  if (!found) {
    console.log(`❌ MISSING: ${idx + 1}. ${patient.name} (${patient.pdf})`);
  } else {
    const lineNum = currentPatients.indexOf(patient.name) + 1;
    console.log(`✅ Line ${lineNum}: ${patient.name}`);
  }
});
