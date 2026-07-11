/**
 * Risk Factors Formatter
 * Formats patient risk factors for Claude AI context
 */

function formatDate(dateValue) {
  if (!dateValue) return 'Unknown date';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (err) {
    return 'Unknown date';
  }
}

module.exports = function formatRiskFactors(doc) {
  const lines = [];

  // Assessment Date
  if (doc.assessmentDate || doc.date) {
    lines.push(`Assessment Date: ${formatDate(doc.assessmentDate || doc.date)}`);
  }

  // Risk Factor Name/Category
  if (doc.riskFactor || doc.name || doc.category) {
    lines.push(`Risk Factor: ${doc.riskFactor || doc.name || doc.category}`);
  }

  // Risk Level/Severity
  if (doc.riskLevel || doc.severity) {
    lines.push(`Risk Level: ${doc.riskLevel || doc.severity}`);
  }

  // Risk Score
  if (doc.riskScore !== undefined) {
    lines.push(`Risk Score: ${doc.riskScore}`);
  }

  // Status
  if (doc.status) {
    lines.push(`Status: ${doc.status}`);
  }

  // Type/Classification
  if (doc.type || doc.classification) {
    lines.push(`Type: ${doc.type || doc.classification}`);
  }

  // Cardiovascular Risk Factors
  if (doc.cardiovascular) {
    lines.push(`\nCardiovascular Risk Factors:`);
    if (doc.cardiovascular.hypertension) lines.push(`  Hypertension: ${doc.cardiovascular.hypertension}`);
    if (doc.cardiovascular.hyperlipidemia) lines.push(`  Hyperlipidemia: ${doc.cardiovascular.hyperlipidemia}`);
    if (doc.cardiovascular.diabetes) lines.push(`  Diabetes: ${doc.cardiovascular.diabetes}`);
    if (doc.cardiovascular.smoking) lines.push(`  Smoking: ${doc.cardiovascular.smoking}`);
    if (doc.cardiovascular.familyHistory) lines.push(`  Family History: ${doc.cardiovascular.familyHistory}`);
  }

  // Lifestyle Risk Factors
  if (doc.lifestyle) {
    lines.push(`\nLifestyle Risk Factors:`);
    if (doc.lifestyle.smoking) lines.push(`  Smoking: ${doc.lifestyle.smoking}`);
    if (doc.lifestyle.alcohol) lines.push(`  Alcohol Use: ${doc.lifestyle.alcohol}`);
    if (doc.lifestyle.exercise) lines.push(`  Exercise: ${doc.lifestyle.exercise}`);
    if (doc.lifestyle.diet) lines.push(`  Diet: ${doc.lifestyle.diet}`);
    if (doc.lifestyle.sleep) lines.push(`  Sleep: ${doc.lifestyle.sleep}`);
  }

  // Medical Conditions
  if (doc.medicalConditions && Array.isArray(doc.medicalConditions)) {
    lines.push(`\nMedical Conditions: ${doc.medicalConditions.join(', ')}`);
  }

  // Family History
  if (doc.familyHistory && Array.isArray(doc.familyHistory)) {
    lines.push(`\nFamily History: ${doc.familyHistory.join(', ')}`);
  }

  // Social Determinants
  if (doc.socialDeterminants) {
    lines.push(`\nSocial Determinants:`);
    if (doc.socialDeterminants.housing) lines.push(`  Housing: ${doc.socialDeterminants.housing}`);
    if (doc.socialDeterminants.employment) lines.push(`  Employment: ${doc.socialDeterminants.employment}`);
    if (doc.socialDeterminants.education) lines.push(`  Education: ${doc.socialDeterminants.education}`);
    if (doc.socialDeterminants.foodSecurity) lines.push(`  Food Security: ${doc.socialDeterminants.foodSecurity}`);
  }

  // Modifiable Factors
  if (doc.modifiable !== undefined) {
    lines.push(`\nModifiable: ${doc.modifiable ? 'Yes' : 'No'}`);
  }

  // Interventions
  if (doc.interventions && Array.isArray(doc.interventions)) {
    lines.push(`\nRecommended Interventions:`);
    doc.interventions.forEach((intervention, index) => {
      lines.push(`  ${index + 1}. ${intervention}`);
    });
  }

  // Clinical Impact
  if (doc.clinicalImpact || doc.impact) {
    lines.push(`\nClinical Impact: ${doc.clinicalImpact || doc.impact}`);
  }

  // Monitoring Frequency
  if (doc.monitoringFrequency) {
    lines.push(`Monitoring Frequency: ${doc.monitoringFrequency}`);
  }

  // Last Assessed By
  if (doc.assessedBy) {
    lines.push(`Assessed By: ${doc.assessedBy}`);
  }

  // Next Assessment Date
  if (doc.nextAssessmentDate) {
    lines.push(`Next Assessment: ${formatDate(doc.nextAssessmentDate)}`);
  }

  // Notes
  if (doc.notes || doc.comments) {
    lines.push(`\nNotes: ${doc.notes || doc.comments}`);
  }

  return lines.join('\n');
};
