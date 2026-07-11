module.exports = {
  title: '✅ Health Maintenance',
  columns: ['Date', 'Screening', 'Result', 'Next Due', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Screening: getValue(entry.screening || entry.test),
      Result: getValue(entry.result || entry.outcome),
      'Next Due': entry.nextDue ? new Date(entry.nextDue).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
