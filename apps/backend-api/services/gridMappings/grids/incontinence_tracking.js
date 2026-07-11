module.exports = {
  title: '💧 Incontinence Tracking',
  columns: ['Date/Time', 'Type', 'Severity', 'Intervention', 'Response'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Type: getValue(entry.type || entry.incontinenceType),
      Severity: getValue(entry.severity || entry.amount),
      Intervention: getValue(entry.intervention || entry.management),
      Response: getValue(entry.response || entry.outcome)
    }));
  }
};
