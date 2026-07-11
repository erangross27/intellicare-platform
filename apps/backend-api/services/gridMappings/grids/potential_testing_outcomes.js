module.exports = {
  title: '🔬 Potential Testing Outcomes',
  columns: ['Date', 'Test Type', 'Possible Results', 'Implications', 'Provider'],
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
      'Possible Results': getValue(entry.possibleResults || entry.outcomes),
      Implications: getValue(entry.implications || entry.meaning),
      Provider: getValue(entry.provider)
    }));
  }
};
