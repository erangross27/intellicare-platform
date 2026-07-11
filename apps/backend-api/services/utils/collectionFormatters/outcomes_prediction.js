/**
 * Outcomes Prediction Formatter
 * Formats AI-generated outcome predictions and risk assessments
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

module.exports = function formatOutcomesPrediction(doc) {
  const lines = [];

  // Analysis Date
  if (doc.analysisDate || doc.date) {
    lines.push(`Analysis Date: ${formatDate(doc.analysisDate || doc.date)}`);
  }

  // Prediction Timeframe
  if (doc.predictionTimeframe || doc.timeHorizon) {
    lines.push(`Prediction Timeframe: ${doc.predictionTimeframe || doc.timeHorizon}`);
  }

  // Predictions Array
  if (doc.predictions && Array.isArray(doc.predictions)) {
    lines.push(`\nOutcome Predictions (${doc.predictions.length}):`);

    doc.predictions.forEach((pred, index) => {
      lines.push(`\n${index + 1}. ${pred.outcome || pred.condition}`);

      if (pred.probability || pred.risk) {
        lines.push(`   Probability: ${pred.probability || pred.risk}`);
      }
      if (pred.riskLevel) {
        lines.push(`   Risk Level: ${pred.riskLevel}`);
      }
      if (pred.timeframe) {
        lines.push(`   Timeframe: ${pred.timeframe}`);
      }
      if (pred.confidenceInterval) {
        lines.push(`   Confidence Interval: ${pred.confidenceInterval}`);
      }
      if (pred.contributingFactors && Array.isArray(pred.contributingFactors)) {
        lines.push(`   Contributing Factors: ${pred.contributingFactors.join(', ')}`);
      }
      if (pred.mitigationStrategies && Array.isArray(pred.mitigationStrategies)) {
        lines.push(`   Mitigation Strategies:`);
        pred.mitigationStrategies.forEach((strategy, i) => {
          lines.push(`      ${i + 1}. ${strategy}`);
        });
      }
    });
  }

  // Risk Scores
  if (doc.riskScores) {
    lines.push(`\nRisk Scores:`);
    Object.entries(doc.riskScores).forEach(([key, value]) => {
      lines.push(`   ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
  }

  // Mortality Risk
  if (doc.mortalityRisk) {
    lines.push(`\nMortality Risk: ${doc.mortalityRisk}`);
    if (doc.mortalityTimeframe) {
      lines.push(`Timeframe: ${doc.mortalityTimeframe}`);
    }
  }

  // Readmission Risk
  if (doc.readmissionRisk) {
    lines.push(`\nReadmission Risk: ${doc.readmissionRisk}`);
    if (doc.readmissionTimeframe) {
      lines.push(`Timeframe: ${doc.readmissionTimeframe}`);
    }
  }

  // Complication Risks
  if (doc.complicationRisks && Array.isArray(doc.complicationRisks)) {
    lines.push(`\nComplication Risks:`);
    doc.complicationRisks.forEach((risk, index) => {
      if (typeof risk === 'object') {
        lines.push(`${index + 1}. ${risk.complication}: ${risk.probability || risk.risk}`);
      } else {
        lines.push(`${index + 1}. ${risk}`);
      }
    });
  }

  // Protective Factors
  if (doc.protectiveFactors && Array.isArray(doc.protectiveFactors)) {
    lines.push(`\nProtective Factors: ${doc.protectiveFactors.join(', ')}`);
  }

  // Modifiable Risk Factors
  if (doc.modifiableRiskFactors && Array.isArray(doc.modifiableRiskFactors)) {
    lines.push(`\nModifiable Risk Factors: ${doc.modifiableRiskFactors.join(', ')}`);
  }

  // Non-Modifiable Risk Factors
  if (doc.nonModifiableRiskFactors && Array.isArray(doc.nonModifiableRiskFactors)) {
    lines.push(`\nNon-Modifiable Risk Factors: ${doc.nonModifiableRiskFactors.join(', ')}`);
  }

  // Intervention Recommendations
  if (doc.interventionRecommendations && Array.isArray(doc.interventionRecommendations)) {
    lines.push(`\nIntervention Recommendations:`);
    doc.interventionRecommendations.forEach((rec, index) => {
      if (typeof rec === 'object') {
        lines.push(`${index + 1}. ${rec.intervention}`);
        if (rec.expectedImpact) {
          lines.push(`   Expected Impact: ${rec.expectedImpact}`);
        }
        if (rec.priority) {
          lines.push(`   Priority: ${rec.priority}`);
        }
      } else {
        lines.push(`${index + 1}. ${rec}`);
      }
    });
  }

  // Model Information
  if (doc.modelUsed) {
    lines.push(`\nPrediction Model: ${doc.modelUsed}`);
  }
  if (doc.modelAccuracy) {
    lines.push(`Model Accuracy: ${doc.modelAccuracy}`);
  }

  // AI Confidence
  if (doc.confidence || doc.overallConfidence) {
    lines.push(`AI Confidence: ${doc.confidence || doc.overallConfidence}`);
  }

  // Source Document
  if (doc.documentId) {
    lines.push(`\nSource Document ID: ${doc.documentId}`);
  }

  // Disclaimer
  lines.push(`\nNote: These predictions are based on statistical models and should be used as clinical decision support, not as definitive diagnoses.`);

  return lines.join('\n');
};
