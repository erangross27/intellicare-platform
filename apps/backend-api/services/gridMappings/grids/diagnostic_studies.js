module.exports = {
  title: '🔬 Diagnostic Studies',
  columns: ['Date', 'Study Type', 'Result', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Study Type': getValue(entry.studyType || entry.test || entry.type),
      Result: getValue(entry.result || entry.findings),
      Interpretation: getValue(entry.interpretation || entry.impression),
      Provider: getValue(entry.provider)
    }));
  }
};
