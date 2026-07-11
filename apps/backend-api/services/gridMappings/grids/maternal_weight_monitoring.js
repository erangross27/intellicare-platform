module.exports = {
  title: '⚖️ Maternal Weight Monitoring',
  columns: ['Date', 'Gestational Age', 'Weight', 'Weight Gain', 'Provider'],
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
      Weight: getValue(entry.weight || entry.currentWeight),
      'Weight Gain': getValue(entry.weightGain || entry.totalGain),
      Provider: getValue(entry.provider)
    }));
  }
};
