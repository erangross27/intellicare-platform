/**
 * Administrative Data Formatter
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

module.exports = function formatAdministrativeData(doc) {
  const lines = [];
  if (doc.recordDate || doc.date) lines.push(`Record Date: ${formatDate(doc.recordDate || doc.date)}`);
  if (doc.dataType || doc.type) lines.push(`Type: ${doc.dataType || doc.type}`);
  if (doc.description) lines.push(`Description: ${doc.description}`);
  if (doc.category) lines.push(`Category: ${doc.category}`);
  if (doc.value) lines.push(`Value: ${doc.value}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.notes) lines.push(`Notes: ${doc.notes}`);
  return lines.join('\n');
};
