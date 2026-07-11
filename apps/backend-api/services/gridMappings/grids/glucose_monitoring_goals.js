module.exports = {
  title: '📊 Glucose Monitoring Goals',
  columns: ['Date', 'Target Range', 'Frequency', 'Current Average', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Target Range': getValue(entry.targetRange || entry.goal),
      Frequency: getValue(entry.frequency || entry.checkingFrequency),
      'Current Average': getValue(entry.currentAverage || entry.average),
      Status: getValue(entry.status || entry.progress)
    }));
  }
};
