/**
 * Emergency Information Formatter
 */
module.exports = function formatEmergencyInfo(doc) {
  const lines = [];
  if (doc.emergencyContact) lines.push(`Emergency Contact: ${doc.emergencyContact}`);
  if (doc.relationship) lines.push(`Relationship: ${doc.relationship}`);
  if (doc.phone) lines.push(`Phone: ${doc.phone}`);
  if (doc.alternatePhone) lines.push(`Alternate Phone: ${doc.alternatePhone}`);
  if (doc.address) lines.push(`Address: ${doc.address}`);
  if (doc.secondaryContact) lines.push(`\nSecondary Contact: ${doc.secondaryContact}`);
  if (doc.secondaryPhone) lines.push(`Phone: ${doc.secondaryPhone}`);
  if (doc.advanceDirective) lines.push(`\nAdvance Directive: ${doc.advanceDirective}`);
  if (doc.powerOfAttorney) lines.push(`Power of Attorney: ${doc.powerOfAttorney}`);
  if (doc.notes) lines.push(`\nNotes: ${doc.notes}`);
  return lines.join('\n');
};
