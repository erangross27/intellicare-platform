/**
 * Intraoperative Records Formatter
 * Formats surgical/intraoperative records for Claude AI context
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

module.exports = function formatIntraoperativeRecord(doc) {
  const lines = [];

  // Procedure Date/Time
  if (doc.procedureDate || doc.date) {
    lines.push(`Procedure Date: ${formatDate(doc.procedureDate || doc.date)}`);
  }
  if (doc.startTime) {
    lines.push(`Start Time: ${doc.startTime}`);
  }
  if (doc.endTime) {
    lines.push(`End Time: ${doc.endTime}`);
  }
  if (doc.duration) {
    lines.push(`Duration: ${doc.duration}`);
  }

  // Procedure Name
  if (doc.procedureName || doc.procedure) {
    lines.push(`\nProcedure: ${doc.procedureName || doc.procedure}`);
  }

  // Surgical Team
  lines.push(`\nSurgical Team:`);
  if (doc.surgeon || doc.primarySurgeon) {
    lines.push(`  Primary Surgeon: ${doc.surgeon || doc.primarySurgeon}`);
  }
  if (doc.assistingSurgeon || doc.assistant) {
    lines.push(`  Assistant: ${doc.assistingSurgeon || doc.assistant}`);
  }
  if (doc.anesthesiologist) {
    lines.push(`  Anesthesiologist: ${doc.anesthesiologist}`);
  }
  if (doc.scrubNurse) {
    lines.push(`  Scrub Nurse: ${doc.scrubNurse}`);
  }
  if (doc.circulatingNurse) {
    lines.push(`  Circulating Nurse: ${doc.circulatingNurse}`);
  }

  // Anesthesia
  if (doc.anesthesiaType || doc.anesthesia) {
    lines.push(`\nAnesthesia Type: ${doc.anesthesiaType || doc.anesthesia}`);
  }
  if (doc.anesthesiaDuration) {
    lines.push(`Anesthesia Duration: ${doc.anesthesiaDuration}`);
  }

  // Patient Position
  if (doc.patientPosition || doc.position) {
    lines.push(`\nPatient Position: ${doc.patientPosition || doc.position}`);
  }

  // Indications
  if (doc.indications || doc.indication) {
    lines.push(`\nIndications: ${doc.indications || doc.indication}`);
  }

  // Preoperative Diagnosis
  if (doc.preoperativeDiagnosis || doc.preOpDiagnosis) {
    lines.push(`Preoperative Diagnosis: ${doc.preoperativeDiagnosis || doc.preOpDiagnosis}`);
  }

  // Postoperative Diagnosis
  if (doc.postoperativeDiagnosis || doc.postOpDiagnosis) {
    lines.push(`Postoperative Diagnosis: ${doc.postoperativeDiagnosis || doc.postOpDiagnosis}`);
  }

  // Operative Findings
  if (doc.operativeFindings || doc.findings) {
    lines.push(`\nOperative Findings: ${doc.operativeFindings || doc.findings}`);
  }

  // Procedure Description
  if (doc.procedureDescription || doc.description || doc.operativeTechnique) {
    lines.push(`\nProcedure Description:\n${doc.procedureDescription || doc.description || doc.operativeTechnique}`);
  }

  // Specimens
  if (doc.specimens && Array.isArray(doc.specimens)) {
    lines.push(`\nSpecimens Sent:`);
    doc.specimens.forEach((specimen, index) => {
      if (typeof specimen === 'object') {
        lines.push(`  ${index + 1}. ${specimen.type || specimen.description}`);
        if (specimen.destination) {
          lines.push(`     Sent to: ${specimen.destination}`);
        }
      } else {
        lines.push(`  ${index + 1}. ${specimen}`);
      }
    });
  }

  // Estimated Blood Loss
  if (doc.estimatedBloodLoss || doc.ebl) {
    lines.push(`\nEstimated Blood Loss: ${doc.estimatedBloodLoss || doc.ebl}`);
  }

  // Fluids Administered
  if (doc.fluidsAdministered) {
    lines.push(`Fluids Administered: ${doc.fluidsAdministered}`);
  }

  // Blood Products
  if (doc.bloodProducts && Array.isArray(doc.bloodProducts)) {
    lines.push(`\nBlood Products Administered:`);
    doc.bloodProducts.forEach((product, index) => {
      lines.push(`  ${index + 1}. ${product}`);
    });
  }

  // Medications Given
  if (doc.medications && Array.isArray(doc.medications)) {
    lines.push(`\nMedications Administered:`);
    doc.medications.forEach((med, index) => {
      if (typeof med === 'object') {
        lines.push(`  ${index + 1}. ${med.name} - ${med.dose} (${med.route}) at ${med.time}`);
      } else {
        lines.push(`  ${index + 1}. ${med}`);
      }
    });
  }

  // Vital Signs
  if (doc.vitalSigns) {
    lines.push(`\nVital Signs Monitoring:`);
    const vitals = doc.vitalSigns;
    if (typeof vitals === 'object') {
      if (vitals.heartRate) lines.push(`  Heart Rate Range: ${vitals.heartRate}`);
      if (vitals.bloodPressure) lines.push(`  Blood Pressure Range: ${vitals.bloodPressure}`);
      if (vitals.oxygenSaturation) lines.push(`  Oxygen Saturation: ${vitals.oxygenSaturation}`);
      if (vitals.temperature) lines.push(`  Temperature: ${vitals.temperature}`);
    } else {
      lines.push(vitals);
    }
  }

  // Drains/Tubes Placed
  if (doc.drainsPlaced && Array.isArray(doc.drainsPlaced)) {
    lines.push(`\nDrains/Tubes Placed:`);
    doc.drainsPlaced.forEach((drain, index) => {
      lines.push(`  ${index + 1}. ${drain}`);
    });
  }

  // Implants/Hardware
  if (doc.implants && Array.isArray(doc.implants)) {
    lines.push(`\nImplants/Hardware:`);
    doc.implants.forEach((implant, index) => {
      if (typeof implant === 'object') {
        lines.push(`  ${index + 1}. ${implant.type || implant.name}`);
        if (implant.manufacturer) {
          lines.push(`     Manufacturer: ${implant.manufacturer}`);
        }
        if (implant.lotNumber) {
          lines.push(`     Lot Number: ${implant.lotNumber}`);
        }
      } else {
        lines.push(`  ${index + 1}. ${implant}`);
      }
    });
  }

  // Complications
  if (doc.complications && Array.isArray(doc.complications)) {
    lines.push(`\nComplications:`);
    doc.complications.forEach((comp, index) => {
      lines.push(`  ${index + 1}. ${comp}`);
    });
  } else if (doc.complications === 'None' || doc.complications === false) {
    lines.push(`\nComplications: None`);
  }

  // Counts
  if (doc.spongeCount || doc.instrumentCount || doc.needleCount) {
    lines.push(`\nCounts:`);
    if (doc.spongeCount) lines.push(`  Sponge Count: ${doc.spongeCount}`);
    if (doc.instrumentCount) lines.push(`  Instrument Count: ${doc.instrumentCount}`);
    if (doc.needleCount) lines.push(`  Needle Count: ${doc.needleCount}`);
  }

  // Condition at End
  if (doc.patientCondition || doc.conditionAtEnd) {
    lines.push(`\nPatient Condition at End of Procedure: ${doc.patientCondition || doc.conditionAtEnd}`);
  }

  // Disposition
  if (doc.disposition || doc.postOpDestination) {
    lines.push(`Disposition: ${doc.disposition || doc.postOpDestination}`);
  }

  // Notes
  if (doc.notes || doc.comments) {
    lines.push(`\nNotes: ${doc.notes || doc.comments}`);
  }

  return lines.join('\n');
};
