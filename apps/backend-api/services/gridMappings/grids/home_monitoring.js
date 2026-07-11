module.exports = {
  title: '📊 Home Monitoring / Trends',
  columns: ['Date', 'Measurement', 'Value', 'Trend', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Measurement: getValue(entry.measurement || entry.type || entry.parameter),
      Value: getValue(entry.value || entry.reading),
      Trend: getValue(entry.trend || entry.direction),
      Status: getValue(entry.status || entry.alert)
    }));
  }
};
