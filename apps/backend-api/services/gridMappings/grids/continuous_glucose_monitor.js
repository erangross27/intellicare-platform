module.exports = {
  title: '📱 Continuous Glucose Monitor',
  columns: ['Date', 'Average Glucose', 'Time in Range', 'Alerts', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Average Glucose': getValue(entry.averageGlucose || entry.avgGlucose),
      'Time in Range': getValue(entry.timeInRange || entry.tir),
      Alerts: getValue(entry.alerts || entry.notifications),
      Provider: getValue(entry.provider)
    }));
  }
};
