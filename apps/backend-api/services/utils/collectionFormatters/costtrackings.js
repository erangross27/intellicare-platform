/**
 * Cost Tracking Formatter
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

module.exports = function formatCostTracking(doc) {
  const lines = [];
  if (doc.date) lines.push(`Date: ${formatDate(doc.date)}`);
  if (doc.serviceType || doc.type) lines.push(`Service Type: ${doc.serviceType || doc.type}`);
  if (doc.cost || doc.amount) lines.push(`Cost: $${doc.cost || doc.amount}`);
  if (doc.provider) lines.push(`Provider: ${doc.provider}`);
  if (doc.category) lines.push(`Category: ${doc.category}`);
  if (doc.paidBy) lines.push(`Paid By: ${doc.paidBy}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.notes) lines.push(`Notes: ${doc.notes}`);
  return lines.join('\n');
};
