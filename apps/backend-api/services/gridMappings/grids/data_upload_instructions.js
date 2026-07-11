module.exports = {
  title: '📤 Data Upload Instructions',
  columns: ['Date', 'Data Type', 'Instructions', 'Frequency', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Data Type': getValue(entry.dataType || entry.type),
      Instructions: getValue(entry.instructions || entry.process),
      Frequency: getValue(entry.frequency || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
