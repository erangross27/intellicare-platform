module.exports = {
  title: '🔢 Sponge & Instrument Counts',
  columns: ['Date', 'Count Type', 'Initial Count', 'Final Count', 'Correct'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Count Type': getValue(entry.countType || entry.type),
      'Initial Count': getValue(entry.initialCount || entry.opening),
      'Final Count': getValue(entry.finalCount || entry.closing),
      Correct: getValue(entry.correct || entry.countsCorrect)
    }));
  }
};
