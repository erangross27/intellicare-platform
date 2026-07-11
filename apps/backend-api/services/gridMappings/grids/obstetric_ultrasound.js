module.exports = {
  title: '🤰 Obstetric Ultrasound',
  columns: ['Date', 'Gestational Age', 'Findings', 'Measurements', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Findings: getValue(entry.findings || entry.impression),
      Measurements: getValue(entry.measurements || entry.biometry),
      Provider: getValue(entry.provider)
    }));
  }
};
