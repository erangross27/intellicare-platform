/**
 * Patient Education Context Formatter
 * Formats AI-generated patient education materials
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

module.exports = function formatPatientEducation(doc) {
  const lines = [];

  // Education Title
  if (doc.title || doc.topic) {
    lines.push(`Topic: ${doc.title || doc.topic}`);
  }

  // Created Date
  if (doc.createdDate || doc.date) {
    lines.push(`Created: ${formatDate(doc.createdDate || doc.date)}`);
  }

  // Education Topics
  if (doc.educationTopics && Array.isArray(doc.educationTopics)) {
    lines.push(`\nEducation Topics (${doc.educationTopics.length}):`);

    doc.educationTopics.forEach((topic, index) => {
      if (typeof topic === 'object') {
        lines.push(`\n${index + 1}. ${topic.topic || topic.title}`);

        if (topic.keyPoints && Array.isArray(topic.keyPoints)) {
          lines.push(`   Key Points:`);
          topic.keyPoints.forEach((point, i) => {
            lines.push(`      • ${point}`);
          });
        }
        if (topic.priority) {
          lines.push(`   Priority: ${topic.priority}`);
        }
        if (topic.readingLevel) {
          lines.push(`   Reading Level: ${topic.readingLevel}`);
        }
      } else {
        lines.push(`${index + 1}. ${topic}`);
      }
    });
  }

  // Condition Overview
  if (doc.conditionOverview) {
    lines.push(`\nCondition Overview: ${doc.conditionOverview}`);
  }

  // What to Expect
  if (doc.whatToExpect) {
    lines.push(`\nWhat to Expect: ${doc.whatToExpect}`);
  }

  // Self-Care Instructions
  if (doc.selfCareInstructions && Array.isArray(doc.selfCareInstructions)) {
    lines.push(`\nSelf-Care Instructions:`);
    doc.selfCareInstructions.forEach((instruction, index) => {
      lines.push(`${index + 1}. ${instruction}`);
    });
  }

  // Warning Signs
  if (doc.warningSigns && Array.isArray(doc.warningSigns)) {
    lines.push(`\nWarning Signs to Watch For:`);
    doc.warningSigns.forEach((sign, index) => {
      lines.push(`${index + 1}. ${sign}`);
    });
  }

  // When to Seek Help
  if (doc.whenToSeekHelp) {
    lines.push(`\nWhen to Seek Help: ${doc.whenToSeekHelp}`);
  }

  // Medication Instructions
  if (doc.medicationInstructions && Array.isArray(doc.medicationInstructions)) {
    lines.push(`\nMedication Instructions:`);
    doc.medicationInstructions.forEach((instruction, index) => {
      lines.push(`${index + 1}. ${instruction}`);
    });
  }

  // Diet and Nutrition
  if (doc.dietAndNutrition && Array.isArray(doc.dietAndNutrition)) {
    lines.push(`\nDiet and Nutrition:`);
    doc.dietAndNutrition.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }

  // Activity Recommendations
  if (doc.activityRecommendations && Array.isArray(doc.activityRecommendations)) {
    lines.push(`\nActivity Recommendations:`);
    doc.activityRecommendations.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }

  // Follow-up Instructions
  if (doc.followUpInstructions) {
    lines.push(`\nFollow-up Instructions: ${doc.followUpInstructions}`);
  }

  // Resources
  if (doc.resources && Array.isArray(doc.resources)) {
    lines.push(`\nAdditional Resources:`);
    doc.resources.forEach((resource, index) => {
      if (typeof resource === 'object') {
        lines.push(`${index + 1}. ${resource.title || resource.name}`);
        if (resource.url) {
          lines.push(`   URL: ${resource.url}`);
        }
      } else {
        lines.push(`${index + 1}. ${resource}`);
      }
    });
  }

  // Questions to Ask Doctor
  if (doc.questionsToAsk && Array.isArray(doc.questionsToAsk)) {
    lines.push(`\nSuggested Questions to Ask Your Doctor:`);
    doc.questionsToAsk.forEach((question, index) => {
      lines.push(`${index + 1}. ${question}`);
    });
  }

  // Language/Reading Level
  if (doc.language) {
    lines.push(`\nLanguage: ${doc.language}`);
  }
  if (doc.readingLevel) {
    lines.push(`Reading Level: ${doc.readingLevel}`);
  }

  // Source Document
  if (doc.documentId) {
    lines.push(`\nSource Document ID: ${doc.documentId}`);
  }

  return lines.join('\n');
};
