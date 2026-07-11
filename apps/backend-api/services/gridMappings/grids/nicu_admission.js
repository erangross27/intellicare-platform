module.exports = {
  title: '👶 NICU Admission',
  columns: ['Date', 'Gestational Age', 'Birth Weight', 'Indication', 'Provider'],
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
      'Birth Weight': getValue(entry.birthWeight || entry.weight),
      Indication: getValue(entry.indication || entry.reason),
      Provider: getValue(entry.provider)
    }));
  }
};
