/**
 * Treatment Courses Formatter
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

module.exports = function formatTreatmentCourse(doc) {
  const lines = [];
  if (doc.startDate) lines.push(`Start Date: ${formatDate(doc.startDate)}`);
  if (doc.endDate) lines.push(`End Date: ${formatDate(doc.endDate)}`);
  if (doc.treatmentName || doc.name) lines.push(`Treatment: ${doc.treatmentName || doc.name}`);
  if (doc.indication) lines.push(`Indication: ${doc.indication}`);
  if (doc.provider) lines.push(`Provider: ${doc.provider}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.outcome) lines.push(`Outcome: ${doc.outcome}`);
  if (doc.notes) lines.push(`\nNotes: ${doc.notes}`);
  return lines.join('\n');
};
