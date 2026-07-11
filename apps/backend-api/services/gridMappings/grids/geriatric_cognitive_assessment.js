module.exports = {
  title: '🧠 Cognitive Assessment',
  columns: ['Date', 'Test', 'Score', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Test: getValue(entry.test || entry.testName),
      Score: getValue(entry.score || entry.result),
      Interpretation: getValue(entry.interpretation || entry.category),
      Provider: getValue(entry.provider)
    }));
  }
};
