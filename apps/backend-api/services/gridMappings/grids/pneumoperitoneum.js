module.exports = {
  title: '💨 Pneumoperitoneum',
  columns: ['Date', 'Method', 'Initial Pressure', 'Maintained Pressure', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Method: getValue(entry.method || entry.technique),
      'Initial Pressure': getValue(entry.initialPressure || entry.pressure),
      'Maintained Pressure': getValue(entry.maintainedPressure || entry.workingPressure),
      Provider: getValue(entry.provider)
    }));
  }
};
