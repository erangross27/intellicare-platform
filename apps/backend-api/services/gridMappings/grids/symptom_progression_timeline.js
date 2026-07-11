module.exports = {
  title: '📈 Symptom Progression Timeline',
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
      Symptom: getValue(entry.symptom || entry.symptomName),
      Severity: getValue(entry.severity || entry.severityScore),
      Trend: getValue(entry.trend || entry.progression),
      Provider: getValue(entry.provider)
    }));
  }
};
