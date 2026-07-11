module.exports = {
  title: '🧠 Psychological Evaluation',
  columns: ['Date', 'Tests Administered', 'Findings', 'Recommendations', 'Psychologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Tests Administered': getValue(entry.testsAdministered || entry.tests),
      Findings: getValue(entry.findings || entry.results),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Psychologist: getValue(entry.psychologist || entry.provider)
    }));
  }
};
