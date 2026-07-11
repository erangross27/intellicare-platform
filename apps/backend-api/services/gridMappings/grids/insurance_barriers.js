module.exports = {
  title: '🚧 Insurance Barriers',
  columns: ['Date', 'Barrier Type', 'Impact', 'Resolution', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Barrier Type': getValue(entry.barrierType || entry.issue),
      Impact: getValue(entry.impact || entry.effect),
      Resolution: getValue(entry.resolution || entry.outcome),
      Provider: getValue(entry.provider)
    }));
  }
};
