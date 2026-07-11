module.exports = {
  title: '🔗 Drain Placement',
  columns: ['Date', 'Drain Type', 'Location', 'Output', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Drain Type': getValue(entry.drainType || entry.type),
      Location: getValue(entry.location || entry.site),
      Output: getValue(entry.output || entry.drainage),
      Provider: getValue(entry.provider)
    }));
  }
};
