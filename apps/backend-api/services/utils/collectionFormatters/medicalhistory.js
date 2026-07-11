/**
 * Medical History Formatter
 * Formats patient medical history records for Claude AI context
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

module.exports = function formatMedicalHistory(doc) {
  const lines = [];

  // History Date
  if (doc.historyDate || doc.recordedDate || doc.date) {
    lines.push(`History Date: ${formatDate(doc.historyDate || doc.recordedDate || doc.date)}`);
  }

  // Recorded By
  if (doc.recordedBy || doc.provider) {
    lines.push(`Recorded By: ${doc.recordedBy || doc.provider}`);
  }

  // Past Medical History
  if (doc.pastMedicalHistory) {
    lines.push(`\nPast Medical History:`);
    if (Array.isArray(doc.pastMedicalHistory)) {
      doc.pastMedicalHistory.forEach((condition, index) => {
        if (typeof condition === 'object') {
          lines.push(`  ${index + 1}. ${condition.condition || condition.name}`);
          if (condition.diagnosisDate) {
            lines.push(`     Diagnosed: ${formatDate(condition.diagnosisDate)}`);
          }
          if (condition.status) {
            lines.push(`     Status: ${condition.status}`);
          }
        } else {
          lines.push(`  ${index + 1}. ${condition}`);
        }
      });
    } else {
      lines.push(doc.pastMedicalHistory);
    }
  }

  // Surgical History
  if (doc.surgicalHistory || doc.pastSurgicalHistory) {
    lines.push(`\nSurgical History:`);
    const surgeries = doc.surgicalHistory || doc.pastSurgicalHistory;
    if (Array.isArray(surgeries)) {
      surgeries.forEach((surgery, index) => {
        if (typeof surgery === 'object') {
          lines.push(`  ${index + 1}. ${surgery.procedure || surgery.name}`);
          if (surgery.date) {
            lines.push(`     Date: ${formatDate(surgery.date)}`);
          }
          if (surgery.surgeon) {
            lines.push(`     Surgeon: ${surgery.surgeon}`);
          }
          if (surgery.complications) {
            lines.push(`     Complications: ${surgery.complications}`);
          }
        } else {
          lines.push(`  ${index + 1}. ${surgery}`);
        }
      });
    } else {
      lines.push(surgeries);
    }
  }

  // Family History
  if (doc.familyHistory) {
    lines.push(`\nFamily History:`);
    if (Array.isArray(doc.familyHistory)) {
      doc.familyHistory.forEach((item, index) => {
        if (typeof item === 'object') {
          lines.push(`  ${index + 1}. ${item.relation}: ${item.condition}`);
          if (item.ageOfOnset) {
            lines.push(`     Age of Onset: ${item.ageOfOnset}`);
          }
        } else {
          lines.push(`  ${index + 1}. ${item}`);
        }
      });
    } else {
      lines.push(doc.familyHistory);
    }
  }

  // Social History
  if (doc.socialHistory) {
    lines.push(`\nSocial History:`);
    const social = doc.socialHistory;
    if (typeof social === 'object') {
      if (social.smoking) lines.push(`  Smoking: ${social.smoking}`);
      if (social.alcohol) lines.push(`  Alcohol: ${social.alcohol}`);
      if (social.drugs) lines.push(`  Recreational Drugs: ${social.drugs}`);
      if (social.occupation) lines.push(`  Occupation: ${social.occupation}`);
      if (social.maritalStatus) lines.push(`  Marital Status: ${social.maritalStatus}`);
      if (social.livingArrangement) lines.push(`  Living Arrangement: ${social.livingArrangement}`);
      if (social.exercise) lines.push(`  Exercise: ${social.exercise}`);
      if (social.diet) lines.push(`  Diet: ${social.diet}`);
    } else {
      lines.push(social);
    }
  }

  // Medication History
  if (doc.medicationHistory && Array.isArray(doc.medicationHistory)) {
    lines.push(`\nMedication History: ${doc.medicationHistory.join(', ')}`);
  }

  // Allergy History
  if (doc.allergyHistory || doc.allergies) {
    lines.push(`\nAllergy History:`);
    const allergies = doc.allergyHistory || doc.allergies;
    if (Array.isArray(allergies)) {
      allergies.forEach((allergy, index) => {
        if (typeof allergy === 'object') {
          lines.push(`  ${index + 1}. ${allergy.allergen}: ${allergy.reaction}`);
          if (allergy.severity) {
            lines.push(`     Severity: ${allergy.severity}`);
          }
        } else {
          lines.push(`  ${index + 1}. ${allergy}`);
        }
      });
    } else {
      lines.push(allergies);
    }
  }

  // Immunization History
  if (doc.immunizationHistory || doc.immunizations) {
    lines.push(`\nImmunization History:`);
    const immunizations = doc.immunizationHistory || doc.immunizations;
    if (Array.isArray(immunizations)) {
      immunizations.forEach((imm, index) => {
        if (typeof imm === 'object') {
          lines.push(`  ${index + 1}. ${imm.vaccine}`);
          if (imm.date) {
            lines.push(`     Date: ${formatDate(imm.date)}`);
          }
        } else {
          lines.push(`  ${index + 1}. ${imm}`);
        }
      });
    } else {
      lines.push(immunizations);
    }
  }

  // Hospitalizations
  if (doc.hospitalizations && Array.isArray(doc.hospitalizations)) {
    lines.push(`\nHospitalizations:`);
    doc.hospitalizations.forEach((hosp, index) => {
      if (typeof hosp === 'object') {
        lines.push(`  ${index + 1}. ${hosp.reason || 'Hospitalization'}`);
        if (hosp.date || hosp.admissionDate) {
          lines.push(`     Date: ${formatDate(hosp.date || hosp.admissionDate)}`);
        }
        if (hosp.facility) {
          lines.push(`     Facility: ${hosp.facility}`);
        }
        if (hosp.duration) {
          lines.push(`     Duration: ${hosp.duration}`);
        }
      } else {
        lines.push(`  ${index + 1}. ${hosp}`);
      }
    });
  }

  // Obstetric/Gynecologic History (if applicable)
  if (doc.obGynHistory) {
    lines.push(`\nOB/GYN History:`);
    const obgyn = doc.obGynHistory;
    if (typeof obgyn === 'object') {
      if (obgyn.gravida) lines.push(`  Gravida: ${obgyn.gravida}`);
      if (obgyn.para) lines.push(`  Para: ${obgyn.para}`);
      if (obgyn.lmp) lines.push(`  LMP: ${formatDate(obgyn.lmp)}`);
      if (obgyn.menopause) lines.push(`  Menopause: ${obgyn.menopause}`);
    } else {
      lines.push(obgyn);
    }
  }

  // Developmental History
  if (doc.developmentalHistory) {
    lines.push(`\nDevelopmental History: ${doc.developmentalHistory}`);
  }

  // Psychiatric History
  if (doc.psychiatricHistory) {
    lines.push(`\nPsychiatric History: ${doc.psychiatricHistory}`);
  }

  // Notes
  if (doc.notes || doc.comments) {
    lines.push(`\nNotes: ${doc.notes || doc.comments}`);
  }

  // Last Updated
  if (doc.lastUpdated) {
    lines.push(`\nLast Updated: ${formatDate(doc.lastUpdated)}`);
  }

  return lines.join('\n');
};
