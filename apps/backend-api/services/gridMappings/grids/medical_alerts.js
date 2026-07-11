module.exports = {
  title: '🚨 Medical Alerts',
  columns: ['Date', 'Alert Type', 'Severity', 'Details', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Alert Type': getValue(entry.alertType || entry.type),
      Severity: getValue(entry.severity || entry.level),
      Details: getValue(entry.details || entry.description),
      Status: getValue(entry.status || entry.alertStatus)
    }));
  }
};
