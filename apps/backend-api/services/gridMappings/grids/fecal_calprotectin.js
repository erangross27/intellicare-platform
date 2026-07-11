module.exports = {
  title: '🔬 Fecal Calprotectin',
  columns: ['Date', 'Result', 'Reference Range', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Result: getValue(entry.result || entry.value),
      'Reference Range': getValue(entry.referenceRange || entry.normalRange),
      Interpretation: getValue(entry.interpretation || entry.significance),
      Provider: getValue(entry.provider)
    }));
  }
};
