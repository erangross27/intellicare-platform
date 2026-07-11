module.exports = {
  title: '🔬 IBD Biomarkers',
  columns: ['Date', 'Test', 'Result', 'Reference Range', 'Interpretation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Test: getValue(entry.test || entry.biomarker),
      Result: getValue(entry.result || entry.value),
      'Reference Range': getValue(entry.referenceRange || entry.normalRange),
      Interpretation: getValue(entry.interpretation || entry.significance)
    }));
  }
};
