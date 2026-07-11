/**
 * Intelligent Recommendations Formatter
 * Formats AI-generated intelligent recommendations
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

module.exports = function formatIntelligentRecommendations(doc) {
  const lines = [];

  // Generated Date
  if (doc.generatedDate || doc.date) {
    lines.push(`Generated: ${formatDate(doc.generatedDate || doc.date)}`);
  }

  // Recommendations Array
  if (doc.recommendations && Array.isArray(doc.recommendations)) {
    lines.push(`\nIntelligent Recommendations (${doc.recommendations.length}):`);

    doc.recommendations.forEach((rec, index) => {
      lines.push(`\n${index + 1}. ${rec.recommendation || rec.title}`);

      if (rec.type || rec.category) {
        lines.push(`   Type: ${rec.type || rec.category}`);
      }
      if (rec.priority) {
        lines.push(`   Priority: ${rec.priority}`);
      }
      if (rec.description) {
        lines.push(`   Description: ${rec.description}`);
      }
      if (rec.reasoning || rec.rationale) {
        lines.push(`   Reasoning: ${rec.reasoning || rec.rationale}`);
      }
      if (rec.expectedBenefit) {
        lines.push(`   Expected Benefit: ${rec.expectedBenefit}`);
      }
      if (rec.implementationSteps && Array.isArray(rec.implementationSteps)) {
        lines.push(`   Implementation Steps:`);
        rec.implementationSteps.forEach((step, i) => {
          lines.push(`      ${i + 1}. ${step}`);
        });
      }
      if (rec.timeframe) {
        lines.push(`   Timeframe: ${rec.timeframe}`);
      }
      if (rec.evidenceLevel) {
        lines.push(`   Evidence Level: ${rec.evidenceLevel}`);
      }
    });
  }

  // Treatment Optimization
  if (doc.treatmentOptimization) {
    lines.push(`\nTreatment Optimization: ${doc.treatmentOptimization}`);
  }

  // Preventive Measures
  if (doc.preventiveMeasures && Array.isArray(doc.preventiveMeasures)) {
    lines.push(`\nPreventive Measures: ${doc.preventiveMeasures.join(', ')}`);
  }

  // Lifestyle Modifications
  if (doc.lifestyleModifications && Array.isArray(doc.lifestyleModifications)) {
    lines.push(`\nLifestyle Modifications: ${doc.lifestyleModifications.join(', ')}`);
  }

  // Source Document
  if (doc.documentId) {
    lines.push(`\nSource Document ID: ${doc.documentId}`);
  }

  // AI Confidence
  if (doc.confidence) {
    lines.push(`AI Confidence: ${doc.confidence}`);
  }

  return lines.join('\n');
};
