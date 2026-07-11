module.exports = {
  title: '⚠️ Abnormal Results',
  columns: ['Date', 'Test', 'Result', 'Reference Range', 'Provider'],
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
      Result: getValue(entry.result || entry.value),
      'Reference Range': getValue(entry.referenceRange || entry.normalRange),
      Provider: getValue(entry.provider)
    }));
  }
};
