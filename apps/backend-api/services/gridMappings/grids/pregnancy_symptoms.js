module.exports = {
  title: '🤰 Pregnancy Symptoms',
  columns: ['Date', 'Symptom', 'Severity', 'Management', 'Provider'],
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
      Severity: getValue(entry.severity || entry.level),
      Management: getValue(entry.management || entry.treatment),
      Provider: getValue(entry.provider)
    }));
  }
};
