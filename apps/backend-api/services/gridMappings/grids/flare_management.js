module.exports = {
  title: '🔥 Flare Management',
  columns: ['Date', 'Severity', 'Triggers', 'Treatment', 'Response'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Severity: getValue(entry.severity || entry.grade),
      Triggers: getValue(entry.triggers || entry.precipitatingFactors),
      Treatment: getValue(entry.treatment || entry.intervention),
      Response: getValue(entry.response || entry.outcome)
    }));
  }
};
