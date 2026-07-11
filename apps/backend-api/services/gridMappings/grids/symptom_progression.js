module.exports = {
  title: '📊 Symptom Progression',
  columns: ['Date', 'Symptom', 'Severity', 'Trend', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Symptom: getValue(entry.symptom || entry.complaint),
      Severity: getValue(entry.severity || entry.grade),
      Trend: getValue(entry.trend || entry.change),
      Provider: getValue(entry.provider)
    }));
  }
};
