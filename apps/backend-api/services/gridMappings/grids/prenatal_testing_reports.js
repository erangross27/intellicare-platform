module.exports = {
  title: '🤰 Prenatal Testing Reports',
  columns: ['Date', 'Test Type', 'Results', 'Risk Assessment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Type': getValue(entry.testType || entry.test),
      Results: getValue(entry.results || entry.findings),
      'Risk Assessment': getValue(entry.riskAssessment || entry.risk),
      Provider: getValue(entry.provider)
    }));
  }
};
