/**
 * Consultation Notes Formatter
 * Formats specialist consultation notes for Claude AI context
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

module.exports = function formatConsultationNotes(doc) {
  const lines = [];

  // Consultation Date
  if (doc.consultationDate || doc.date) {
    lines.push(`Consultation Date: ${formatDate(doc.consultationDate || doc.date)}`);
  }

  // Specialty/Type
  if (doc.specialty || doc.consultationType) {
    lines.push(`Specialty: ${doc.specialty || doc.consultationType}`);
  }

  // Consulting Provider
  if (doc.consultingProvider || doc.provider || doc.consultant) {
    lines.push(`Consulting Provider: ${doc.consultingProvider || doc.provider || doc.consultant}`);
  }

  // Referring Provider
  if (doc.referringProvider || doc.referredBy) {
    lines.push(`Referred By: ${doc.referringProvider || doc.referredBy}`);
  }

  // Reason for Consultation
  if (doc.reasonForConsultation || doc.reason || doc.indication) {
    lines.push(`\nReason for Consultation: ${doc.reasonForConsultation || doc.reason || doc.indication}`);
  }

  // Chief Complaint
  if (doc.chiefComplaint) {
    lines.push(`\nChief Complaint: ${doc.chiefComplaint}`);
  }

  // History of Present Illness
  if (doc.historyOfPresentIllness || doc.hpi) {
    lines.push(`\nHistory of Present Illness:\n${doc.historyOfPresentIllness || doc.hpi}`);
  }

  // Past Medical History
  if (doc.pastMedicalHistory) {
    lines.push(`\nPast Medical History: ${doc.pastMedicalHistory}`);
  }

  // Medications Reviewed
  if (doc.medicationsReviewed && Array.isArray(doc.medicationsReviewed)) {
    lines.push(`\nMedications Reviewed: ${doc.medicationsReviewed.join(', ')}`);
  }

  // Physical Examination
  if (doc.physicalExamination || doc.physicalExam) {
    lines.push(`\nPhysical Examination:`);
    const exam = doc.physicalExamination || doc.physicalExam;
    if (typeof exam === 'object') {
      Object.entries(exam).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`);
      });
    } else {
      lines.push(exam);
    }
  }

  // Review of Systems
  if (doc.reviewOfSystems || doc.ros) {
    lines.push(`\nReview of Systems:`);
    const ros = doc.reviewOfSystems || doc.ros;
    if (typeof ros === 'object') {
      Object.entries(ros).forEach(([system, findings]) => {
        lines.push(`  ${system}: ${findings}`);
      });
    } else {
      lines.push(ros);
    }
  }

  // Diagnostic Studies
  if (doc.diagnosticStudies && Array.isArray(doc.diagnosticStudies)) {
    lines.push(`\nDiagnostic Studies:`);
    doc.diagnosticStudies.forEach((study, index) => {
      lines.push(`  ${index + 1}. ${study}`);
    });
  }

  // Assessment/Impression
  if (doc.assessment || doc.impression || doc.diagnosis) {
    lines.push(`\nAssessment/Impression: ${doc.assessment || doc.impression || doc.diagnosis}`);
  }

  // Differential Diagnosis
  if (doc.differentialDiagnosis && Array.isArray(doc.differentialDiagnosis)) {
    lines.push(`\nDifferential Diagnosis: ${doc.differentialDiagnosis.join(', ')}`);
  }

  // Recommendations
  if (doc.recommendations && Array.isArray(doc.recommendations)) {
    lines.push(`\nRecommendations:`);
    doc.recommendations.forEach((rec, index) => {
      lines.push(`  ${index + 1}. ${rec}`);
    });
  } else if (doc.recommendations) {
    lines.push(`\nRecommendations: ${doc.recommendations}`);
  }

  // Treatment Plan
  if (doc.treatmentPlan || doc.plan) {
    lines.push(`\nTreatment Plan:`);
    const plan = doc.treatmentPlan || doc.plan;
    if (Array.isArray(plan)) {
      plan.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item}`);
      });
    } else {
      lines.push(plan);
    }
  }

  // Follow-up
  if (doc.followUp || doc.followUpPlan) {
    lines.push(`\nFollow-up: ${doc.followUp || doc.followUpPlan}`);
  }

  // Prognosis
  if (doc.prognosis) {
    lines.push(`\nPrognosis: ${doc.prognosis}`);
  }

  // Additional Comments
  if (doc.additionalComments || doc.comments) {
    lines.push(`\nAdditional Comments: ${doc.additionalComments || doc.comments}`);
  }

  // Status
  if (doc.status) {
    lines.push(`\nStatus: ${doc.status}`);
  }

  // Notes
  if (doc.notes) {
    lines.push(`\nNotes: ${doc.notes}`);
  }

  return lines.join('\n');
};
