module.exports = {
  title: '🔬 Rheumatologic Monitoring',
  columns: ['Date', 'Test Type', 'Results', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Type': getValue(entry.testType || entry.test),
      Results: getValue(entry.results || entry.values),
      Interpretation: getValue(entry.interpretation || entry.meaning),
      Provider: getValue(entry.provider)
    }));
  }
};
