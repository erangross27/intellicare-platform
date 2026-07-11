/**
 * Anesthesia Records Formatter
 *
 * Formats anesthesia_records collection documents for display to doctors.
 */

function formatDate(dateValue) {
  if (!dateValue) return 'Unknown date';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (err) {
    return 'Unknown date';
  }
}

module.exports = function formatAnesthesiaRecord(doc) {
  const lines = [];

  // Basic Info
  if (doc.procedureName) lines.push(`Procedure: ${doc.procedureName}`);
  if (doc.date) lines.push(`Date: ${formatDate(doc.date)}`);
  if (doc.asaClassification) lines.push(`ASA Classification: ${doc.asaClassification}`);

  // Chief Complaint
  if (doc.chiefComplaint) {
    lines.push(`\nChief Complaint: ${doc.chiefComplaint}`);
  }

  // Anesthesia Plan
  if (doc.anesthesiaPlan) {
    lines.push(`\nAnesthesia Plan:`);
    if (doc.anesthesiaPlan.type) lines.push(`  Type: ${doc.anesthesiaPlan.type}`);
    if (doc.anesthesiaPlan.rationale) lines.push(`  Rationale: ${doc.anesthesiaPlan.rationale}`);
    if (doc.anesthesiaPlan.alternatives) lines.push(`  Alternatives: ${doc.anesthesiaPlan.alternatives.join(', ')}`);
  }

  // Airway Assessment
  if (doc.airwayAssessment) {
    lines.push(`\nAirway Assessment:`);
    if (doc.airwayAssessment.mallampatiScore) lines.push(`  Mallampati: ${doc.airwayAssessment.mallampatiScore}`);
    if (doc.airwayAssessment.thyromentalDistance) lines.push(`  Thyromental Distance: ${doc.airwayAssessment.thyromentalDistance}`);
    if (doc.airwayAssessment.neckMobility) lines.push(`  Neck Mobility: ${doc.airwayAssessment.neckMobility}`);
    if (doc.airwayAssessment.predictedDifficulty) lines.push(`  Predicted Difficulty: ${doc.airwayAssessment.predictedDifficulty}`);
  }

  // Medications Administered
  if (doc.medicationsAdministered && doc.medicationsAdministered.length > 0) {
    lines.push(`\nMedications Administered:`);
    doc.medicationsAdministered.forEach(med => {
      lines.push(`  • ${med.name} - ${med.dose} (${med.route}) at ${med.time}`);
    });
  }

  // Vital Signs
  if (doc.vitalSigns) {
    lines.push(`\nVital Signs:`);
    if (doc.vitalSigns.preop) lines.push(`  Pre-op: ${JSON.stringify(doc.vitalSigns.preop)}`);
    if (doc.vitalSigns.intraop) lines.push(`  Intra-op: ${JSON.stringify(doc.vitalSigns.intraop)}`);
    if (doc.vitalSigns.postop) lines.push(`  Post-op: ${JSON.stringify(doc.vitalSigns.postop)}`);
  }

  // Complications
  if (doc.complications && doc.complications.length > 0) {
    lines.push(`\nComplications:`);
    doc.complications.forEach(comp => {
      lines.push(`  • ${comp}`);
    });
  }

  // Pain Management
  if (doc.painManagement) {
    lines.push(`\nPain Management:`);
    if (doc.painManagement.preoperative) lines.push(`  Preoperative: ${doc.painManagement.preoperative}`);
    if (doc.painManagement.intraoperative) lines.push(`  Intraoperative: ${doc.painManagement.intraoperative}`);
    if (doc.painManagement.postoperative) lines.push(`  Postoperative: ${doc.painManagement.postoperative}`);
  }

  // Notes
  if (doc.notes) lines.push(`\nNotes: ${doc.notes}`);

  return lines.join('\n');
};
