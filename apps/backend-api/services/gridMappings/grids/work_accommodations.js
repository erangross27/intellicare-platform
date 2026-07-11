module.exports = {
  title: '💼 Work Accommodations',
  columns: ['Date', 'Accommodation Type', 'Duration', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Accommodation Type': getValue(entry.accommodationType || entry.type),
      Duration: getValue(entry.duration || entry.timeframe),
      Status: getValue(entry.status || entry.approval),
      Provider: getValue(entry.provider)
    }));
  }
};
