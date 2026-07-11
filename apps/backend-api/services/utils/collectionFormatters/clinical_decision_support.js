/**
 * Clinical Decision Support Formatter
 * Formats AI-generated clinical decision support recommendations
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

module.exports = function formatClinicalDecisionSupport(doc) {
  const lines = [];

  // Generated Date
  if (doc.generatedDate || doc.date) {
    lines.push(`Generated: ${formatDate(doc.generatedDate || doc.date)}`);
  }

  // Recommendations Array
  if (doc.recommendations && Array.isArray(doc.recommendations)) {
    lines.push(`\nClinical Recommendations (${doc.recommendations.length}):`);
    doc.recommendations.forEach((rec, index) => {
      lines.push(`\n${index + 1}. ${rec.recommendation || rec.title || 'Recommendation'}`);

      if (rec.priority) {
        lines.push(`   Priority: ${rec.priority}`);
      }
      if (rec.category) {
        lines.push(`   Category: ${rec.category}`);
      }
      if (rec.rationale || rec.reasoning) {
        lines.push(`   Rationale: ${rec.rationale || rec.reasoning}`);
      }
      if (rec.evidence || rec.evidenceLevel) {
        lines.push(`   Evidence: ${rec.evidence || rec.evidenceLevel}`);
      }
      if (rec.actionRequired !== undefined) {
        lines.push(`   Action Required: ${rec.actionRequired ? 'Yes' : 'No'}`);
      }
      if (rec.timeframe) {
        lines.push(`   Timeframe: ${rec.timeframe}`);
      }
    });
  }

  // Alerts
  if (doc.alerts && Array.isArray(doc.alerts)) {
    lines.push(`\nClinical Alerts (${doc.alerts.length}):`);
    doc.alerts.forEach((alert, index) => {
      lines.push(`\n${index + 1}. ${alert.alert || alert.message}`);
      if (alert.severity) {
        lines.push(`   Severity: ${alert.severity}`);
      }
    });
  }

  // Risk Factors
  if (doc.riskFactors && Array.isArray(doc.riskFactors)) {
    lines.push(`\nIdentified Risk Factors: ${doc.riskFactors.join(', ')}`);
  }

  // Contraindications
  if (doc.contraindications && Array.isArray(doc.contraindications)) {
    lines.push(`\nContraindications: ${doc.contraindications.join(', ')}`);
  }

  // Drug Interactions
  if (doc.drugInteractions && Array.isArray(doc.drugInteractions)) {
    lines.push(`\nDrug Interactions (${doc.drugInteractions.length}):`);
    doc.drugInteractions.forEach((interaction, index) => {
      if (typeof interaction === 'object') {
        lines.push(`${index + 1}. ${interaction.interaction || interaction.description}`);
        if (interaction.severity) {
          lines.push(`   Severity: ${interaction.severity}`);
        }
      } else {
        lines.push(`${index + 1}. ${interaction}`);
      }
    });
  }

  // Source Document
  if (doc.documentId) {
    lines.push(`\nSource Document ID: ${doc.documentId}`);
  }

  // AI Confidence
  if (doc.confidence) {
    lines.push(`AI Confidence: ${doc.confidence}`);
  }

  // Notes
  if (doc.notes) {
    lines.push(`\nNotes: ${doc.notes}`);
  }

  return lines.join('\n');
};
