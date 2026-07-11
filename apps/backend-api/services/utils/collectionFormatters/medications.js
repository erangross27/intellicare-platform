/**
 * Medications Formatter
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

module.exports = function formatMedication(doc) {
  const lines = [];

  if (doc.medicationName || doc.name) lines.push(`Medication: ${doc.medicationName || doc.name}`);
  if (doc.dosage) lines.push(`Dosage: ${doc.dosage}`);
  if (doc.frequency) lines.push(`Frequency: ${doc.frequency}`);
  if (doc.route) lines.push(`Route: ${doc.route}`);
  if (doc.startDate) lines.push(`Started: ${formatDate(doc.startDate)}`);
  if (doc.endDate) lines.push(`End Date: ${formatDate(doc.endDate)}`);
  if (doc.prescribedBy) lines.push(`Prescribed By: ${doc.prescribedBy}`);
  if (doc.reason || doc.indication) lines.push(`Reason: ${doc.reason || doc.indication}`);
  if (doc.instructions) lines.push(`Instructions: ${doc.instructions}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);

  return lines.join('\n');
};
