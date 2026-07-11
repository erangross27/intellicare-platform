module.exports = {
  title: '⚖️ Weight Measurements',
  columns: ['Date', 'Weight', 'Unit', 'Method', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight || entry.value),
      Unit: getValue(entry.unit || entry.units),
      Method: getValue(entry.method || entry.technique),
      Provider: getValue(entry.provider)
    }));
  }
};
