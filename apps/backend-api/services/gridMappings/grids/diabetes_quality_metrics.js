module.exports = {
  title: '📊 Diabetes Quality Metrics',
  columns: ['Date', 'HbA1c', 'BP', 'LDL', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      HbA1c: getValue(entry.hba1c || entry.a1c),
      BP: getValue(entry.bp || entry.bloodPressure),
      LDL: getValue(entry.ldl || entry.cholesterol),
      Provider: getValue(entry.provider)
    }));
  }
};
