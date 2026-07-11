module.exports = {
  title: '🔩 Fixation Method',
  columns: ['Date', 'Method', 'Hardware', 'Location', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Method: getValue(entry.method || entry.technique),
      Hardware: getValue(entry.hardware || entry.implants),
      Location: getValue(entry.location || entry.site),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
