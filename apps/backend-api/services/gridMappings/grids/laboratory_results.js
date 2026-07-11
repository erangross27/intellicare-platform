module.exports = {
  title: '🧪 Laboratory Results',
  columns: ['Date', 'Test Name', 'Value', 'Reference Range', 'Provider'],
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
      Value: getValue(entry.value || entry.result),
      'Reference Range': getValue(entry.referenceRange || entry.range),
      Provider: getValue(entry.provider)
    }));
  }
};
