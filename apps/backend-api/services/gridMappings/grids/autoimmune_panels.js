module.exports = {
  title: '🧬 Autoimmune Panels',
  columns: ['Date', 'Test Name', 'Result', 'Reference Range', 'Rheumatologist'],
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
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
