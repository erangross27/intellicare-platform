/**
 * Patient Specific Care Plan Formatter
 * Formats AI-generated personalized care plans
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

module.exports = function formatPatientCarePlan(doc) {
  const lines = [];

  // Care Plan Title
  if (doc.carePlanTitle || doc.title) {
    lines.push(`Care Plan: ${doc.carePlanTitle || doc.title}`);
  }

  // Created Date
  if (doc.createdDate || doc.date) {
    lines.push(`Created: ${formatDate(doc.createdDate || doc.date)}`);
  }

  // Plan Duration
  if (doc.duration || (doc.startDate && doc.endDate)) {
    if (doc.duration) {
      lines.push(`Duration: ${doc.duration}`);
    } else {
      lines.push(`Duration: ${formatDate(doc.startDate)} to ${formatDate(doc.endDate)}`);
    }
  }

  // Primary Goals
  if (doc.primaryGoals && Array.isArray(doc.primaryGoals)) {
    lines.push(`\nPrimary Goals (${doc.primaryGoals.length}):`);
    doc.primaryGoals.forEach((goal, index) => {
      if (typeof goal === 'object') {
        lines.push(`${index + 1}. ${goal.goal || goal.description}`);
        if (goal.targetDate) {
          lines.push(`   Target Date: ${formatDate(goal.targetDate)}`);
        }
        if (goal.measurableOutcome) {
          lines.push(`   Measurable Outcome: ${goal.measurableOutcome}`);
        }
      } else {
        lines.push(`${index + 1}. ${goal}`);
      }
    });
  }

  // Treatment Plan
  if (doc.treatmentPlan && Array.isArray(doc.treatmentPlan)) {
    lines.push(`\nTreatment Plan (${doc.treatmentPlan.length} items):`);
    doc.treatmentPlan.forEach((item, index) => {
      if (typeof item === 'object') {
        lines.push(`${index + 1}. ${item.intervention || item.treatment}`);
        if (item.frequency) {
          lines.push(`   Frequency: ${item.frequency}`);
        }
        if (item.duration) {
          lines.push(`   Duration: ${item.duration}`);
        }
      } else {
        lines.push(`${index + 1}. ${item}`);
      }
    });
  }

  // Monitoring Plan
  if (doc.monitoringPlan && Array.isArray(doc.monitoringPlan)) {
    lines.push(`\nMonitoring Plan:`);
    doc.monitoringPlan.forEach((item, index) => {
      if (typeof item === 'object') {
        lines.push(`${index + 1}. ${item.parameter || item.metric}`);
        if (item.frequency) {
          lines.push(`   Frequency: ${item.frequency}`);
        }
        if (item.targetRange) {
          lines.push(`   Target Range: ${item.targetRange}`);
        }
      } else {
        lines.push(`${index + 1}. ${item}`);
      }
    });
  }

  // Follow-up Schedule
  if (doc.followUpSchedule && Array.isArray(doc.followUpSchedule)) {
    lines.push(`\nFollow-up Schedule:`);
    doc.followUpSchedule.forEach((item, index) => {
      if (typeof item === 'object') {
        lines.push(`${index + 1}. ${item.type || item.appointment} - ${item.date ? formatDate(item.date) : item.timeframe}`);
      } else {
        lines.push(`${index + 1}. ${item}`);
      }
    });
  }

  // Patient Education Topics
  if (doc.patientEducation && Array.isArray(doc.patientEducation)) {
    lines.push(`\nPatient Education Topics: ${doc.patientEducation.join(', ')}`);
  }

  // Lifestyle Modifications
  if (doc.lifestyleModifications && Array.isArray(doc.lifestyleModifications)) {
    lines.push(`\nLifestyle Modifications: ${doc.lifestyleModifications.join(', ')}`);
  }

  // Precautions
  if (doc.precautions && Array.isArray(doc.precautions)) {
    lines.push(`\nPrecautions: ${doc.precautions.join(', ')}`);
  }

  // Emergency Contact Instructions
  if (doc.emergencyInstructions) {
    lines.push(`\nEmergency Instructions: ${doc.emergencyInstructions}`);
  }

  // Source Document
  if (doc.documentId) {
    lines.push(`\nSource Document ID: ${doc.documentId}`);
  }

  // Next Review Date
  if (doc.nextReviewDate) {
    lines.push(`Next Review Date: ${formatDate(doc.nextReviewDate)}`);
  }

  return lines.join('\n');
};
