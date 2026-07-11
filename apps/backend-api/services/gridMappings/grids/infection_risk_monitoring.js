module.exports = {
  title: '🦠 Infection Risk Monitoring',
  columns: ['Date', 'Risk Factors', 'Surveillance', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Factors': getValue(entry.riskFactors || entry.risks),
      Surveillance: getValue(entry.surveillance || entry.monitoring),
      Interventions: getValue(entry.interventions || entry.prophylaxis),
      Provider: getValue(entry.provider)
    }));
  }
};
