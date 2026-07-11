/**
 * Quality Metrics Formatter
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

module.exports = function formatQualityMetric(doc) {
  const lines = [];
  if (doc.metricDate || doc.date) lines.push(`Date: ${formatDate(doc.metricDate || doc.date)}`);
  if (doc.metricName || doc.name) lines.push(`Metric: ${doc.metricName || doc.name}`);
  if (doc.value !== undefined) lines.push(`Value: ${doc.value}`);
  if (doc.target) lines.push(`Target: ${doc.target}`);
  if (doc.category) lines.push(`Category: ${doc.category}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.notes) lines.push(`Notes: ${doc.notes}`);
  return lines.join('\n');
};
