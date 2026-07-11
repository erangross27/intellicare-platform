module.exports = {
  title: '🧠 Behavioral Assessment',
  columns: ['Date', 'Behaviors', 'Severity', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Behaviors: getValue(entry.behaviors || entry.concerns),
      Severity: getValue(entry.severity || entry.level),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
