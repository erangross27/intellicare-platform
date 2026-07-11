module.exports = {
  title: '⚠️ Complications',
  columns: ['Date', 'Complication', 'Severity', 'Management', 'Resolution'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Complication: getValue(entry.complication || entry.event),
      Severity: getValue(entry.severity || entry.grade),
      Management: getValue(entry.management || entry.treatment),
      Resolution: getValue(entry.resolution || entry.outcome)
    }));
  }
};
