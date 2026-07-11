module.exports = {
  title: '💧 Fluid Output',
  columns: ['Date/Time', 'Type', 'Volume', 'Characteristics', 'Total'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Type: getValue(entry.type || entry.source),
      Volume: getValue(entry.volume || entry.amount),
      Characteristics: getValue(entry.characteristics || entry.appearance),
      Total: getValue(entry.total || entry.cumulative)
    }));
  }
};
