module.exports = {
  title: '🧬 Medical Genetics Assessment',
  columns: ['Date', 'Genetic Condition', 'Testing', 'Results', 'Geneticist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Genetic Condition': getValue(entry.geneticCondition || entry.condition),
      Testing: getValue(entry.testing || entry.testPerformed),
      Results: getValue(entry.results || entry.findings),
      Geneticist: getValue(entry.geneticist || entry.provider)
    }));
  }
};
