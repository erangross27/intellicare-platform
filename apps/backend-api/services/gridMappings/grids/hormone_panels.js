module.exports = {
  title: '🧬 Hormone Panels',
  columns: ['Date', 'Hormone', 'Value', 'Reference Range', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Hormone: getValue(entry.hormone || entry.testName),
      Value: getValue(entry.value || entry.result),
      'Reference Range': getValue(entry.referenceRange || entry.range),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
