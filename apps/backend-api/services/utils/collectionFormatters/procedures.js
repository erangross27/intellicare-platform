/**
 * Procedures Formatter
 * Formats medical procedure records for Claude AI context
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

module.exports = function formatProcedure(doc) {
  const lines = [];

  // Procedure Name
  if (doc.procedureName || doc.name || doc.procedure) {
    lines.push(`Procedure: ${doc.procedureName || doc.name || doc.procedure}`);
  }

  // Procedure Code
  if (doc.cptCode) {
    lines.push(`CPT Code: ${doc.cptCode}`);
  }
  if (doc.icdProcedureCode) {
    lines.push(`ICD Procedure Code: ${doc.icdProcedureCode}`);
  }

  // Type/Category
  if (doc.procedureType || doc.category) {
    lines.push(`Type: ${doc.procedureType || doc.category}`);
  }

  // Date/Time
  if (doc.procedureDate || doc.performedDate || doc.date) {
    lines.push(`Date Performed: ${formatDate(doc.procedureDate || doc.performedDate || doc.date)}`);
  }
  if (doc.startTime || doc.procedureStartTime) {
    lines.push(`Start Time: ${doc.startTime || doc.procedureStartTime}`);
  }
  if (doc.endTime || doc.procedureEndTime) {
    lines.push(`End Time: ${doc.endTime || doc.procedureEndTime}`);
  }
  if (doc.duration) {
    lines.push(`Duration: ${doc.duration}`);
  }

  // Performer
  if (doc.performedBy || doc.surgeon || doc.provider) {
    lines.push(`Performed By: ${doc.performedBy || doc.surgeon || doc.provider}`);
  }

  // Assistant
  if (doc.assistant || doc.assistingSurgeon) {
    lines.push(`Assistant: ${doc.assistant || doc.assistingSurgeon}`);
  }

  // Anesthesiologist
  if (doc.anesthesiologist) {
    lines.push(`Anesthesiologist: ${doc.anesthesiologist}`);
  }

  // Anesthesia Type
  if (doc.anesthesiaType) {
    lines.push(`Anesthesia: ${doc.anesthesiaType}`);
  }

  // Location
  if (doc.location || doc.facility) {
    lines.push(`Location: ${doc.location || doc.facility}`);
  }

  // Indication
  if (doc.indication || doc.reason) {
    lines.push(`Indication: ${doc.indication || doc.reason}`);
  }

  // Status
  if (doc.status) {
    lines.push(`Status: ${doc.status}`);
  }

  // Outcome
  if (doc.outcome) {
    lines.push(`Outcome: ${doc.outcome}`);
  }

  // Findings
  if (doc.findings) {
    lines.push(`Findings: ${doc.findings}`);
  }

  // Complications
  if (doc.complications) {
    if (Array.isArray(doc.complications)) {
      lines.push(`Complications: ${doc.complications.join(', ')}`);
    } else {
      lines.push(`Complications: ${doc.complications}`);
    }
  }

  // Estimated Blood Loss
  if (doc.estimatedBloodLoss || doc.ebl) {
    lines.push(`Estimated Blood Loss: ${doc.estimatedBloodLoss || doc.ebl}`);
  }

  // Follow-up
  if (doc.followUpInstructions || doc.followUp) {
    lines.push(`Follow-up: ${doc.followUpInstructions || doc.followUp}`);
  }

  // Notes
  if (doc.notes || doc.comments || doc.operativeNotes) {
    lines.push(`Notes: ${doc.notes || doc.comments || doc.operativeNotes}`);
  }

  return lines.join('\n');
};
