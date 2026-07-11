module.exports = {
  title: '🫀 Fetal Echocardiogram',
  columns: ['Date', 'Gestational Age', 'Findings', 'Interpretation', 'Cardiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.weeks),
      Findings: getValue(entry.findings || entry.result),
      Interpretation: getValue(entry.interpretation || entry.impression),
      Cardiologist: getValue(entry.cardiologist || entry.provider)
    }));
  }
};
