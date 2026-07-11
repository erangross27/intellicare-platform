module.exports = {
  title: '👴 Frailty Assessment',
  columns: ['Date', 'Frailty Score', 'Components', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Frailty Score': getValue(entry.frailtyScore || entry.score),
      Components: getValue(entry.components || entry.domains),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
