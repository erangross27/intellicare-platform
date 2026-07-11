/**
 * History of Present Illness Formatter
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

module.exports = function formatHPI(doc) {
  const lines = [];
  if (doc.recordedDate || doc.date) lines.push(`Recorded: ${formatDate(doc.recordedDate || doc.date)}`);
  if (doc.chiefComplaint) lines.push(`Chief Complaint: ${doc.chiefComplaint}`);
  if (doc.hpi || doc.narrative) lines.push(`\nHistory of Present Illness:\n${doc.hpi || doc.narrative}`);
  if (doc.onset) lines.push(`\nOnset: ${doc.onset}`);
  if (doc.duration) lines.push(`Duration: ${doc.duration}`);
  if (doc.severity) lines.push(`Severity: ${doc.severity}`);
  if (doc.associatedSymptoms) lines.push(`Associated Symptoms: ${Array.isArray(doc.associatedSymptoms) ? doc.associatedSymptoms.join(', ') : doc.associatedSymptoms}`);
  if (doc.notes) lines.push(`\nNotes: ${doc.notes}`);
  return lines.join('\n');
};
