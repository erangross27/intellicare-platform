module.exports = {
  title: '🫀 Fetal Echocardiography',
  columns: ['Date', 'Gestational Age', 'Findings', 'Cardiac Structure', 'Cardiologist'],
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
      Findings: getValue(entry.findings || entry.results),
      'Cardiac Structure': getValue(entry.cardiacStructure || entry.anatomy),
      Cardiologist: getValue(entry.cardiologist || entry.provider)
    }));
  }
};
