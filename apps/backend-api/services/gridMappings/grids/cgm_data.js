module.exports = {
  title: '📊 CGM Data',
  columns: ['Date/Time', 'Glucose', 'Trend', 'Alert', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Glucose: getValue(entry.glucose || entry.value),
      Trend: getValue(entry.trend || entry.direction),
      Alert: getValue(entry.alert, 'None'),
      Status: getValue(entry.status, 'Normal')
    }));
  }
};
