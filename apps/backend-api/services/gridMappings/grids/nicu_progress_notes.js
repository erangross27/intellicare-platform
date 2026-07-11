module.exports = {
  title: '👶 NICU Progress Notes',
  columns: ['Date', 'Weight', 'Respiratory Status', 'Feeding', 'Neonatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight || entry.currentWeight),
      'Respiratory Status': getValue(entry.respiratoryStatus || entry.respiratory),
      Feeding: getValue(entry.feeding || entry.nutritionStatus),
      Neonatologist: getValue(entry.neonatologist || entry.provider)
    }));
  }
};
