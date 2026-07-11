module.exports = {
  title: '👶 Neonatal Assessment',
  columns: ['Date', 'Weight', 'APGAR', 'Feeding', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight || entry.birthWeight),
      APGAR: getValue(entry.apgar || entry.apgarScore),
      Feeding: getValue(entry.feeding || entry.feedingType),
      Provider: getValue(entry.provider)
    }));
  }
};
