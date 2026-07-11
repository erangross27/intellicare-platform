/**
 * Reminders Formatter
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

module.exports = function formatReminder(doc) {
  const lines = [];
  if (doc.reminderDate || doc.date) lines.push(`Date: ${formatDate(doc.reminderDate || doc.date)}`);
  if (doc.type || doc.reminderType) lines.push(`Type: ${doc.type || doc.reminderType}`);
  if (doc.message || doc.description) lines.push(`Message: ${doc.message || doc.description}`);
  if (doc.priority) lines.push(`Priority: ${doc.priority}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.dueDate) lines.push(`Due Date: ${formatDate(doc.dueDate)}`);
  if (doc.notes) lines.push(`Notes: ${doc.notes}`);
  return lines.join('\n');
};
