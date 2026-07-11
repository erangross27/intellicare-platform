module.exports = {
  title: '🔄 Readmission Risk',
  columns: ['Date', 'Risk Score', 'Risk Factors', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Score': getValue(entry.riskScore || entry.score),
      'Risk Factors': getValue(entry.riskFactors || entry.factors),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
