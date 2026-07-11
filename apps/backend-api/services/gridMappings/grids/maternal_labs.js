module.exports = {
  title: '🧪 Maternal Labs',
  columns: ['Date', 'Test Name', 'Result', 'Reference Range', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Name': getValue(entry.testName || entry.test),
      Result: getValue(entry.result || entry.value),
      'Reference Range': getValue(entry.referenceRange || entry.range),
      Provider: getValue(entry.provider)
    }));
  }
};
