module.exports = {
  title: '🧩 Psychosocial Factors',
  columns: ['Date', 'Factor Type', 'Impact', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Factor Type': getValue(entry.factorType || entry.type),
      Impact: getValue(entry.impact || entry.effect),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
