module.exports = {
  title: '⚠️ Fall Risk Assessments',
  columns: ['Date', 'Risk Level', 'Contributing Factors', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Level': getValue(entry.riskLevel || entry.risk),
      'Contributing Factors': getValue(entry.contributingFactors || entry.factors),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
