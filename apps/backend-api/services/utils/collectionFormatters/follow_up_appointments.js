/**
 * Follow-up Appointments Formatter
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

module.exports = function formatFollowUpAppointment(doc) {
  const lines = [];
  if (doc.appointmentDate || doc.date) lines.push(`Appointment Date: ${formatDate(doc.appointmentDate || doc.date)}`);
  if (doc.time) lines.push(`Time: ${doc.time}`);
  if (doc.provider) lines.push(`Provider: ${doc.provider}`);
  if (doc.reason || doc.purpose) lines.push(`Reason: ${doc.reason || doc.purpose}`);
  if (doc.specialty) lines.push(`Specialty: ${doc.specialty}`);
  if (doc.location) lines.push(`Location: ${doc.location}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.notes) lines.push(`Notes: ${doc.notes}`);
  return lines.join('\n');
};
