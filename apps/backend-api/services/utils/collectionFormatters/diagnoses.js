/**
 * Diagnoses Formatter
 * Formats diagnosis records for Claude AI context
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

module.exports = function formatDiagnosis(doc) {
  const lines = [];

  // Diagnosis name/code
  if (doc.diagnosis || doc.name || doc.condition) {
    lines.push(`Diagnosis: ${doc.diagnosis || doc.name || doc.condition}`);
  }

  // ICD codes
  if (doc.icdCode || doc.icd10Code) {
    lines.push(`ICD Code: ${doc.icdCode || doc.icd10Code}`);
  }
  if (doc.icd9Code) {
    lines.push(`ICD-9 Code: ${doc.icd9Code}`);
  }

  // Status and type
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.type || doc.diagnosisType) {
    lines.push(`Type: ${doc.type || doc.diagnosisType}`);
  }

  // Severity
  if (doc.severity) lines.push(`Severity: ${doc.severity}`);

  // Dates
  if (doc.diagnosisDate || doc.onsetDate) {
    lines.push(`Diagnosis Date: ${formatDate(doc.diagnosisDate || doc.onsetDate)}`);
  }
  if (doc.resolvedDate) {
    lines.push(`Resolved Date: ${formatDate(doc.resolvedDate)}`);
  }

  // Clinical info
  if (doc.diagnosedBy || doc.provider) {
    lines.push(`Diagnosed By: ${doc.diagnosedBy || doc.provider}`);
  }
  if (doc.clinicalStatus) {
    lines.push(`Clinical Status: ${doc.clinicalStatus}`);
  }
  if (doc.verificationStatus) {
    lines.push(`Verification: ${doc.verificationStatus}`);
  }

  // Notes
  if (doc.notes || doc.comments) {
    lines.push(`Notes: ${doc.notes || doc.comments}`);
  }

  return lines.join('\n');
};
