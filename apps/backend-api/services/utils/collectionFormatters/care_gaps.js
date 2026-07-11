/**
 * Care Gaps Formatter
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

module.exports = function formatCareGap(doc) {
  const lines = [];
  if (doc.identifiedDate || doc.date) lines.push(`Identified: ${formatDate(doc.identifiedDate || doc.date)}`);
  if (doc.gapType || doc.type) lines.push(`Gap Type: ${doc.gapType || doc.type}`);
  if (doc.description) lines.push(`Description: ${doc.description}`);
  if (doc.priority) lines.push(`Priority: ${doc.priority}`);
  if (doc.recommendation) lines.push(`Recommendation: ${doc.recommendation}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.dueDate) lines.push(`Due Date: ${formatDate(doc.dueDate)}`);
  if (doc.notes) lines.push(`Notes: ${doc.notes}`);
  return lines.join('\n');
};
