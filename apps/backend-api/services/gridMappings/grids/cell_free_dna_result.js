module.exports = {
  title: '🧬 Cell-Free DNA Result',
  columns: ['Date', 'Test Type', 'Results', 'Risk', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Type': getValue(entry.testType || entry.nipt),
      Results: getValue(entry.results || entry.findings),
      Risk: getValue(entry.risk || entry.riskLevel),
      Provider: getValue(entry.provider)
    }));
  }
};
