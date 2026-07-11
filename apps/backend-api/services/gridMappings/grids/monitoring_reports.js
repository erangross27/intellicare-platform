module.exports = {
  title: '📊 Monitoring Reports',
  columns: ['Date', 'Parameter', 'Value', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Parameter: getValue(entry.parameter || entry.metric),
      Value: getValue(entry.value || entry.measurement),
      Status: getValue(entry.status || entry.interpretation),
      Provider: getValue(entry.provider)
    }));
  }
};
