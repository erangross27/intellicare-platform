module.exports = {
  title: 'Patient-Specific Care Plan (AI)',
  columns: ['date', 'type', 'intervention', 'context', 'barriers', 'strategy', 'outcomeMetrics'],
  headers: ['Date', 'Type', 'Intervention/Recommendation', 'Patient Context', 'Barriers', 'Strategy', 'Success Metrics'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatOutcomeMetrics = (metrics) => {
      if (!metrics || typeof metrics !== 'object') return '-';

      const parts = [];

      if (metrics.primaryOutcome) {
        parts.push(`🎯 ${metrics.primaryOutcome}`);
      }

      if (metrics.secondaryOutcomes && Array.isArray(metrics.secondaryOutcomes)) {
        parts.push(`Secondary:\n${metrics.secondaryOutcomes.map(m => `• ${m}`).join('\n')}`);
      }

      if (metrics.assessmentMethod) {
        parts.push(`📊 Assessment: ${metrics.assessmentMethod}`);
      }

      if (metrics.targetDate) {
        parts.push(`📅 Target: ${metrics.targetDate}`);
      }

      return parts.length > 0 ? parts.join('\n') : '-';
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Tailored Interventions
      if (entry.tailoredInterventions && Array.isArray(entry.tailoredInterventions)) {
        entry.tailoredInterventions.forEach(intervention => {
          rows.push({
            date,
            'type': 'Intervention',
            'intervention': getValue(intervention.intervention),
            'context': getValue(intervention.personalizationFactors ?
              intervention.personalizationFactors.join(', ') : '-'),
            'barriers': getValue(intervention.barriers ? intervention.barriers.join('; ') : '-'),
            'strategy': getValue(intervention.adherenceStrategy),
            'outcomeMetrics': formatOutcomeMetrics(intervention.outcomeMetrics)
          });
        });
      }

      // Lifestyle Modifications
      if (entry.lifestyleModifications && Array.isArray(entry.lifestyleModifications)) {
        entry.lifestyleModifications.forEach(mod => {
          rows.push({
            date,
            'type': getValue(mod.domain),
            'intervention': getValue(mod.recommendation),
            'context': getValue(mod.patientContext) + ' (Current: ' + getValue(mod.currentStatus) + ')',
            'barriers': getValue(mod.feasibility),
            'strategy': getValue(mod.expectedBenefit),
            'outcomeMetrics': formatOutcomeMetrics(mod.outcomeMetrics)
          });
        });
      }

      // Comorbidity Management
      if (entry.comorbidityManagement) {
        rows.push({
          date,
          'type': 'Comorbidity Management',
          'intervention': getValue(entry.comorbidityManagement.integratedApproach),
          'context': getValue(entry.comorbidityManagement.interactions ?
            entry.comorbidityManagement.interactions.join('; ') : '-'),
          'barriers': '-',
          'strategy': getValue(entry.comorbidityManagement.prioritization),
          'outcomeMetrics': '-'
        });
      }
    });

    return rows;
  }
};
