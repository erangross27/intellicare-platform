module.exports = {
  title: '🧬 Prenatal Screening',
  columns: ['Date', 'Gestational Age', 'Test', 'Result', 'Risk'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Test: getValue(entry.test || entry.screeningTest),
      Result: getValue(entry.result || entry.findings),
      Risk: getValue(entry.risk || entry.riskAssessment)
    }));
  }
};
