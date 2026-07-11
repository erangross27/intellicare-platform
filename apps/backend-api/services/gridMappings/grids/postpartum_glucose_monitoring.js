module.exports = {
  title: '📊 Postpartum Glucose Monitoring',
  columns: ['Date', 'Glucose Level', 'Test Type', 'Follow-up Needed', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Glucose Level': getValue(entry.glucoseLevel || entry.value),
      'Test Type': getValue(entry.testType || entry.test),
      'Follow-up Needed': getValue(entry.followUpNeeded || entry.followUp),
      Provider: getValue(entry.provider)
    }));
  }
};
