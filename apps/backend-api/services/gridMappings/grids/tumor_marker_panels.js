module.exports = {
  title: '🧬 Tumor Marker Panels',
  columns: ['Date', 'Marker', 'Value', 'Reference Range', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Marker: getValue(entry.marker || entry.testName),
      Value: getValue(entry.value || entry.result),
      'Reference Range': getValue(entry.referenceRange || entry.range),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
