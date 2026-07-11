module.exports = {
  title: '⚖️ Weight Monitoring',
  columns: ['Date', 'Weight', 'Change', 'Trend', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight || entry.value),
      Change: getValue(entry.change || entry.delta),
      Trend: getValue(entry.trend || entry.direction),
      Provider: getValue(entry.provider)
    }));
  }
};
