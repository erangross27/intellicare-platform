module.exports = {
  title: '🧬 Cytogenetics',
  columns: ['Date', 'Test Type', 'Karyotype', 'Abnormality', 'Interpretation'],
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
      Karyotype: getValue(entry.karyotype || entry.result),
      Abnormality: getValue(entry.abnormality || entry.findings),
      Interpretation: getValue(entry.interpretation || entry.significance)
    }));
  }
};
