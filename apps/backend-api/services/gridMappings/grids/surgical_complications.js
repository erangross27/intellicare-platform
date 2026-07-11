module.exports = {
  title: '⚠️ Surgical Complications',
  columns: ['Date', 'Complication', 'Severity', 'Management', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Complication: getValue(entry.complication || entry.type),
      Severity: getValue(entry.severity || entry.grade),
      Management: getValue(entry.management || entry.treatment),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
