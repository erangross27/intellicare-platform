module.exports = {
  title: '👶 Well Child Summary',
  columns: ['Date', 'Age', 'Growth Parameters', 'Development', 'Pediatrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateEquals() : '-',
      Age: getValue(entry.age || entry.childAge),
      'Growth Parameters': getValue(entry.growthParameters || entry.growth),
      Development: getValue(entry.development || entry.developmentalStatus),
      Pediatrician: getValue(entry.pediatrician || entry.provider)
    }));
  }
};
