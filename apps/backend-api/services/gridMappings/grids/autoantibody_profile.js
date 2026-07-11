module.exports = {
  title: '🔬 Autoantibody Profile',
  columns: ['Date', 'Antibody', 'Result', 'Titer', 'Interpretation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Antibody: getValue(entry.antibody || entry.test),
      Result: getValue(entry.result),
      Titer: getValue(entry.titer || entry.value),
      Interpretation: getValue(entry.interpretation)
    }));
  }
};
