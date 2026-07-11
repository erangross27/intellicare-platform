module.exports = {
  title: '🔪 IBD Surgical Planning',
  columns: ['Date', 'Indication', 'Procedure', 'Timeline', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Procedure: getValue(entry.procedure || entry.operation),
      Timeline: getValue(entry.timeline || entry.scheduledDate),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
