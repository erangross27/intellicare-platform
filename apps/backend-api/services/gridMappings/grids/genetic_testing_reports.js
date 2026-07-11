module.exports = {
  title: '🧬 Genetic Testing Reports',
  columns: ['Date', 'Test Type', 'Gene/Variant', 'Interpretation', 'Geneticist'],
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
      'Gene/Variant': getValue(entry.geneVariant || entry.gene || entry.variant),
      Interpretation: getValue(entry.interpretation || entry.result),
      Geneticist: getValue(entry.geneticist || entry.provider)
    }));
  }
};
