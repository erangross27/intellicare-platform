module.exports = {
  title: '🏥 Postoperative Condition',
  columns: ['Date', 'Vital Signs', 'Pain Level', 'Status', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Vital Signs': getValue(entry.vitalSigns || entry.vitals),
      'Pain Level': getValue(entry.painLevel || entry.pain),
      Status: getValue(entry.status || entry.condition),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
