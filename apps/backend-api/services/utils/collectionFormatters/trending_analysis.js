/**
 * Trending Analysis Formatter
 * Formats AI-generated trend analysis across patient data
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

module.exports = function formatTrendingAnalysis(doc) {
  const lines = [];

  // Analysis Date
  if (doc.analysisDate || doc.date) {
    lines.push(`Analysis Date: ${formatDate(doc.analysisDate || doc.date)}`);
  }

  // Time Period
  if (doc.timePeriod || (doc.startDate && doc.endDate)) {
    if (doc.timePeriod) {
      lines.push(`Time Period: ${doc.timePeriod}`);
    } else {
      lines.push(`Time Period: ${formatDate(doc.startDate)} to ${formatDate(doc.endDate)}`);
    }
  }

  // Trends Array
  if (doc.trends && Array.isArray(doc.trends)) {
    lines.push(`\nIdentified Trends (${doc.trends.length}):`);

    doc.trends.forEach((trend, index) => {
      lines.push(`\n${index + 1}. ${trend.parameter || trend.metric}`);

      if (trend.direction) {
        lines.push(`   Direction: ${trend.direction}`);
      }
      if (trend.change || trend.changePercentage) {
        lines.push(`   Change: ${trend.change || trend.changePercentage}`);
      }
      if (trend.baseline) {
        lines.push(`   Baseline: ${trend.baseline}`);
      }
      if (trend.current) {
        lines.push(`   Current: ${trend.current}`);
      }
      if (trend.significance) {
        lines.push(`   Significance: ${trend.significance}`);
      }
      if (trend.clinicalImplication) {
        lines.push(`   Clinical Implication: ${trend.clinicalImplication}`);
      }
      if (trend.actionRequired !== undefined) {
        lines.push(`   Action Required: ${trend.actionRequired ? 'Yes' : 'No'}`);
      }
    });
  }

  // Vital Signs Trends
  if (doc.vitalSignsTrends) {
    lines.push(`\nVital Signs Trends:`);
    Object.entries(doc.vitalSignsTrends).forEach(([key, value]) => {
      lines.push(`   ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
  }

  // Lab Results Trends
  if (doc.labResultsTrends) {
    lines.push(`\nLab Results Trends:`);
    Object.entries(doc.labResultsTrends).forEach(([key, value]) => {
      lines.push(`   ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
  }

  // Medication Adherence Trends
  if (doc.medicationAdherenceTrend) {
    lines.push(`\nMedication Adherence Trend: ${doc.medicationAdherenceTrend}`);
  }

  // Clinical Concerns
  if (doc.clinicalConcerns && Array.isArray(doc.clinicalConcerns)) {
    lines.push(`\nClinical Concerns: ${doc.clinicalConcerns.join(', ')}`);
  }

  // Positive Trends
  if (doc.positiveTrends && Array.isArray(doc.positiveTrends)) {
    lines.push(`\nPositive Trends: ${doc.positiveTrends.join(', ')}`);
  }

  // Recommendations
  if (doc.recommendations && Array.isArray(doc.recommendations)) {
    lines.push(`\nRecommendations: ${doc.recommendations.join(', ')}`);
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
