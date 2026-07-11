module.exports = {
  title: '👶 Birth History',
  columns: ['Date', 'Gestational Age', 'Birth Weight', 'Complications', 'Pediatrician'],
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
      Complications: getValue(entry.complications || entry.issues),
      Pediatrician: getValue(entry.pediatrician || entry.provider)
    }));
  }
};
