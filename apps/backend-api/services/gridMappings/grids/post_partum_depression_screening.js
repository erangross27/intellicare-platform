module.exports = {
  title: '🤱 Postpartum Depression Screen',
  columns: ['Date', 'Score', 'Severity', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Score: getValue(entry.score || entry.epdsScore),
      Severity: getValue(entry.severity || entry.riskLevel),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
