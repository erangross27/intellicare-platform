/**
 * Lab Results Formatter
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

module.exports = function formatLabResult(doc) {
  const lines = [];

  if (doc.testName) lines.push(`Test: ${doc.testName}`);
  if (doc.value !== undefined) {
    const unit = doc.unit ? ` ${doc.unit}` : '';
    lines.push(`Result: ${doc.value}${unit}`);
  }
  if (doc.referenceRange) lines.push(`Reference Range: ${doc.referenceRange}`);
  if (doc.status || doc.abnormalFlag) {
    const status = doc.abnormalFlag || doc.status;
    lines.push(`Status: ${status}`);
  }
  if (doc.performedDate) lines.push(`Date Performed: ${formatDate(doc.performedDate)}`);
  if (doc.interpretation) lines.push(`Interpretation: ${doc.interpretation}`);
  if (doc.orderedBy) lines.push(`Ordered By: ${doc.orderedBy}`);
  if (doc.specimen) lines.push(`Specimen: ${doc.specimen}`);

  return lines.join('\n');
};
