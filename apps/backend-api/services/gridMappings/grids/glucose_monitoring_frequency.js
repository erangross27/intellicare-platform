module.exports = {
  title: '📊 Glucose Monitoring Frequency',
  columns: ['Date', 'Frequency', 'Times', 'Target Range', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Frequency: getValue(entry.frequency || entry.schedule),
      Times: getValue(entry.times || entry.timesPerDay),
      'Target Range': getValue(entry.targetRange || entry.goals),
      Provider: getValue(entry.provider)
    }));
  }
};
