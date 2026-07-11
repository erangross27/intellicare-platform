module.exports = {
  title: '🛡️ Safety Assessment',
  columns: ['Date', 'Risk Type', 'Risk Level', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Type': getValue(entry.riskType || entry.type),
      'Risk Level': getValue(entry.riskLevel || entry.level),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
