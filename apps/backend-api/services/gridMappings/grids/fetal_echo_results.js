module.exports = {
  title: '🫀 Fetal Echo Results',
  columns: ['Date', 'Cardiac Structures', 'Abnormalities', 'Recommendation', 'Cardiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cardiac Structures': getValue(entry.cardiacStructures || entry.structures),
      Abnormalities: getValue(entry.abnormalities || entry.findings),
      Recommendation: getValue(entry.recommendation || entry.plan),
      Cardiologist: getValue(entry.cardiologist || entry.provider)
    }));
  }
};
