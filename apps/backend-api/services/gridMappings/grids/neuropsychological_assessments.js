module.exports = {
  title: '🧠 Neuropsychological Assessment',
  columns: ['Date', 'Tests Performed', 'Cognitive Domain', 'Results', 'Psychologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Tests Performed': getValue(entry.testsPerformed || entry.tests),
      'Cognitive Domain': getValue(entry.cognitiveDomain || entry.domain),
      Results: getValue(entry.results || entry.findings),
      Psychologist: getValue(entry.psychologist || entry.provider)
    }));
  }
};
