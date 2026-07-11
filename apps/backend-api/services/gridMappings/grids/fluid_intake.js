module.exports = {
  title: '💧 Fluid Intake',
  columns: ['Date/Time', 'Type', 'Volume', 'Route', 'Total'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Type: getValue(entry.type || entry.fluidType),
      Volume: getValue(entry.volume || entry.amount),
      Route: getValue(entry.route || entry.administration),
      Total: getValue(entry.total || entry.cumulative)
    }));
  }
};
