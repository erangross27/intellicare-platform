/**
 * Imaging Reports Formatter
 * Formats imaging/radiology reports for Claude AI context
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

module.exports = function formatImagingReport(doc) {
  const lines = [];

  // Study Type
  if (doc.studyType || doc.imagingType || doc.modalityType) {
    lines.push(`Study Type: ${doc.studyType || doc.imagingType || doc.modalityType}`);
  }

  // Modality
  if (doc.modality) {
    lines.push(`Modality: ${doc.modality}`);
  }

  // Body Part/Region
  if (doc.bodyPart || doc.anatomicRegion) {
    lines.push(`Body Part: ${doc.bodyPart || doc.anatomicRegion}`);
  }

  // Study Date
  if (doc.studyDate || doc.performedDate || doc.date) {
    lines.push(`Study Date: ${formatDate(doc.studyDate || doc.performedDate || doc.date)}`);
  }

  // Ordered By
  if (doc.orderedBy || doc.orderingPhysician) {
    lines.push(`Ordered By: ${doc.orderedBy || doc.orderingPhysician}`);
  }

  // Performed By
  if (doc.performedBy || doc.technologist) {
    lines.push(`Performed By: ${doc.performedBy || doc.technologist}`);
  }

  // Interpreted By
  if (doc.interpretedBy || doc.radiologist) {
    lines.push(`Interpreted By: ${doc.interpretedBy || doc.radiologist}`);
  }

  // Indication/Reason
  if (doc.indication || doc.reason) {
    lines.push(`Indication: ${doc.indication || doc.reason}`);
  }

  // Technique
  if (doc.technique) {
    lines.push(`Technique: ${doc.technique}`);
  }

  // Comparison
  if (doc.comparison) {
    lines.push(`Comparison: ${doc.comparison}`);
  }

  // Findings
  if (doc.findings) {
    lines.push(`Findings: ${doc.findings}`);
  }

  // Impression
  if (doc.impression || doc.conclusion) {
    lines.push(`Impression: ${doc.impression || doc.conclusion}`);
  }

  // Recommendations
  if (doc.recommendations) {
    if (Array.isArray(doc.recommendations)) {
      lines.push(`Recommendations: ${doc.recommendations.join(', ')}`);
    } else {
      lines.push(`Recommendations: ${doc.recommendations}`);
    }
  }

  // Status
  if (doc.status) {
    lines.push(`Status: ${doc.status}`);
  }

  // Accession Number
  if (doc.accessionNumber) {
    lines.push(`Accession Number: ${doc.accessionNumber}`);
  }

  // Study Instance UID
  if (doc.studyInstanceUID) {
    lines.push(`Study UID: ${doc.studyInstanceUID}`);
  }

  // Notes
  if (doc.notes || doc.comments) {
    lines.push(`Notes: ${doc.notes || doc.comments}`);
  }

  return lines.join('\n');
};
