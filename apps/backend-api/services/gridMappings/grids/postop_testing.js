module.exports = {
  title: '🧪 Post-Op Testing',
  columns: ['Date', 'Test Type', 'Results', 'Action Taken', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Type': getValue(entry.testType || entry.test),
      Results: getValue(entry.results || entry.findings),
      'Action Taken': getValue(entry.actionTaken || entry.management),
      Provider: getValue(entry.provider)
    }));
  }
};
