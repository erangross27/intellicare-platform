module.exports = {
  title: '🛡️ Preventive Medicine Assessment',
  columns: ['Date', 'Risk Factors', 'Screenings Due', 'Recommendations', 'Provider'],
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
      'Screenings Due': getValue(entry.screeningsDue || entry.screenings),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
