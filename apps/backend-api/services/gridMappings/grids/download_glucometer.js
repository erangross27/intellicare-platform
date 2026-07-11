module.exports = {
  title: '📊 Glucometer Downloads',
  columns: ['Date', 'Device', 'Readings Count', 'Average', 'Range'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Device: getValue(entry.device || entry.glucometer),
      'Readings Count': getValue(entry.readingsCount || entry.count),
      Average: getValue(entry.average || entry.avgGlucose),
      Range: getValue(entry.range || entry.glucoseRange)
    }));
  }
};
