module.exports = {
  title: '📈 Disease Severity',
  columns: ['Date', 'Disease', 'Severity', 'Progression', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Disease: getValue(entry.disease || entry.condition),
      Severity: getValue(entry.severity || entry.grade),
      Progression: getValue(entry.progression || entry.trend),
      Provider: getValue(entry.provider)
    }));
  }
};
