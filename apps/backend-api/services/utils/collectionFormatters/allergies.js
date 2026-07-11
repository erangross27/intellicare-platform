/**
 * Allergies Formatter
 * Formats allergy records for Claude AI context
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

module.exports = function formatAllergy(doc) {
  const lines = [];

  // Allergen
  if (doc.allergen || doc.substance || doc.name) {
    lines.push(`Allergen: ${doc.allergen || doc.substance || doc.name}`);
  }

  // Allergy Type
  if (doc.allergyType || doc.type) {
    lines.push(`Type: ${doc.allergyType || doc.type}`);
  }

  // Reaction
  if (doc.reaction) {
    if (Array.isArray(doc.reaction)) {
      lines.push(`Reaction: ${doc.reaction.join(', ')}`);
    } else {
      lines.push(`Reaction: ${doc.reaction}`);
    }
  }

  // Severity
  if (doc.severity) {
    lines.push(`Severity: ${doc.severity}`);
  }

  // Status
  if (doc.status) {
    lines.push(`Status: ${doc.status}`);
  }

  // Clinical Status
  if (doc.clinicalStatus) {
    lines.push(`Clinical Status: ${doc.clinicalStatus}`);
  }

  // Verification Status
  if (doc.verificationStatus) {
    lines.push(`Verification: ${doc.verificationStatus}`);
  }

  // Onset Date
  if (doc.onsetDate || doc.identifiedDate) {
    lines.push(`Onset Date: ${formatDate(doc.onsetDate || doc.identifiedDate)}`);
  }

  // Last Occurrence
  if (doc.lastOccurrence) {
    lines.push(`Last Occurrence: ${formatDate(doc.lastOccurrence)}`);
  }

  // Criticality
  if (doc.criticality) {
    lines.push(`Criticality: ${doc.criticality}`);
  }

  // Category
  if (doc.category) {
    if (Array.isArray(doc.category)) {
      lines.push(`Category: ${doc.category.join(', ')}`);
    } else {
      lines.push(`Category: ${doc.category}`);
    }
  }

  // Reported By
  if (doc.reportedBy || doc.reportedByPatient) {
    lines.push(`Reported By: ${doc.reportedBy || (doc.reportedByPatient ? 'Patient' : 'Unknown')}`);
  }

  // Recorded By
  if (doc.recordedBy) {
    lines.push(`Recorded By: ${doc.recordedBy}`);
  }

  // Notes
  if (doc.notes || doc.comments) {
    lines.push(`Notes: ${doc.notes || doc.comments}`);
  }

  return lines.join('\n');
};
