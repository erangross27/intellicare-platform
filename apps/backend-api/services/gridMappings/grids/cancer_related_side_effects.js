module.exports = {
  title: '🎗️ Cancer-Related Side Effects',
  columns: ['Date', 'Side Effect', 'Severity', 'Management', 'Resolution'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Side Effect': getValue(entry.sideEffect || entry.adverseEvent || entry.symptom),
      Severity: getValue(entry.severity || entry.grade),
      Management: getValue(entry.management || entry.intervention),
      Resolution: getValue(entry.resolution || entry.outcome)
    }));
  }
};
