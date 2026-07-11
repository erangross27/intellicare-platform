/**
 * Medication Optimization Formatter
 * Formats AI-generated medication optimization recommendations
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

module.exports = function formatMedicationOptimization(doc) {
  const lines = [];

  // Analysis Date
  if (doc.analysisDate || doc.date) {
    lines.push(`Analysis Date: ${formatDate(doc.analysisDate || doc.date)}`);
  }

  // Optimization Opportunities
  if (doc.optimizationOpportunities && Array.isArray(doc.optimizationOpportunities)) {
    lines.push(`\nOptimization Opportunities (${doc.optimizationOpportunities.length}):`);

    doc.optimizationOpportunities.forEach((opp, index) => {
      lines.push(`\n${index + 1}. ${opp.title || opp.opportunity}`);

      if (opp.currentMedication) {
        lines.push(`   Current Medication: ${opp.currentMedication}`);
      }
      if (opp.suggestedChange) {
        lines.push(`   Suggested Change: ${opp.suggestedChange}`);
      }
      if (opp.rationale) {
        lines.push(`   Rationale: ${opp.rationale}`);
      }
      if (opp.expectedBenefit) {
        lines.push(`   Expected Benefit: ${opp.expectedBenefit}`);
      }
      if (opp.priority) {
        lines.push(`   Priority: ${opp.priority}`);
      }
      if (opp.evidenceLevel) {
        lines.push(`   Evidence Level: ${opp.evidenceLevel}`);
      }
    });
  }

  // Drug Interactions Identified
  if (doc.drugInteractions && Array.isArray(doc.drugInteractions)) {
    lines.push(`\nDrug Interactions (${doc.drugInteractions.length}):`);
    doc.drugInteractions.forEach((interaction, index) => {
      if (typeof interaction === 'object') {
        lines.push(`${index + 1}. ${interaction.drugs || interaction.interaction}`);
        if (interaction.severity) {
          lines.push(`   Severity: ${interaction.severity}`);
        }
        if (interaction.recommendation) {
          lines.push(`   Recommendation: ${interaction.recommendation}`);
        }
      } else {
        lines.push(`${index + 1}. ${interaction}`);
      }
    });
  }

  // Duplicate Therapies
  if (doc.duplicateTherapies && Array.isArray(doc.duplicateTherapies)) {
    lines.push(`\nDuplicate Therapies Identified: ${doc.duplicateTherapies.join(', ')}`);
  }

  // Dosing Recommendations
  if (doc.dosingRecommendations && Array.isArray(doc.dosingRecommendations)) {
    lines.push(`\nDosing Recommendations (${doc.dosingRecommendations.length}):`);
    doc.dosingRecommendations.forEach((rec, index) => {
      if (typeof rec === 'object') {
        lines.push(`${index + 1}. ${rec.medication}`);
        if (rec.currentDose) {
          lines.push(`   Current Dose: ${rec.currentDose}`);
        }
        if (rec.recommendedDose) {
          lines.push(`   Recommended Dose: ${rec.recommendedDose}`);
        }
        if (rec.rationale) {
          lines.push(`   Rationale: ${rec.rationale}`);
        }
      } else {
        lines.push(`${index + 1}. ${rec}`);
      }
    });
  }

  // Cost Optimization
  if (doc.costOptimization && Array.isArray(doc.costOptimization)) {
    lines.push(`\nCost Optimization Opportunities:`);
    doc.costOptimization.forEach((item, index) => {
      if (typeof item === 'object') {
        lines.push(`${index + 1}. ${item.medication}: ${item.suggestion}`);
        if (item.estimatedSavings) {
          lines.push(`   Estimated Savings: ${item.estimatedSavings}`);
        }
      } else {
        lines.push(`${index + 1}. ${item}`);
      }
    });
  }

  // Adherence Issues
  if (doc.adherenceIssues && Array.isArray(doc.adherenceIssues)) {
    lines.push(`\nAdherence Issues: ${doc.adherenceIssues.join(', ')}`);
  }

  // Monitoring Recommendations
  if (doc.monitoringRecommendations && Array.isArray(doc.monitoringRecommendations)) {
    lines.push(`\nMonitoring Recommendations: ${doc.monitoringRecommendations.join(', ')}`);
  }

  // Therapeutic Alternatives
  if (doc.therapeuticAlternatives && Array.isArray(doc.therapeuticAlternatives)) {
    lines.push(`\nTherapeutic Alternatives:`);
    doc.therapeuticAlternatives.forEach((alt, index) => {
      if (typeof alt === 'object') {
        lines.push(`${index + 1}. For ${alt.currentMedication}: ${alt.alternative}`);
        if (alt.advantage) {
          lines.push(`   Advantage: ${alt.advantage}`);
        }
      } else {
        lines.push(`${index + 1}. ${alt}`);
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

  return lines.join('\n');
};
