module.exports = {
  title: '✅ Quality Assurance',
  columns: ['Date', 'Metric', 'Target', 'Actual', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Metric: getValue(entry.metric || entry.measure),
      Target: getValue(entry.target || entry.goal),
      Actual: getValue(entry.actual || entry.value),
      Status: getValue(entry.status || entry.result)
    }));
  }
};
