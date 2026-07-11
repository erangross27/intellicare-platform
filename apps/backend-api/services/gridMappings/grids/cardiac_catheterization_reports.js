module.exports = {
  title: '❤️ Cardiac Catheterization',
  columns: ['Date', 'Indication', 'Findings', 'Intervention', 'Cardiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Findings: getValue(entry.findings || entry.results),
      Intervention: getValue(entry.intervention || entry.procedure),
      Cardiologist: getValue(entry.cardiologist || entry.provider)
    }));
  }
};
