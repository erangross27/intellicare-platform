module.exports = {
  title: '🔬 Umbilical Artery Doppler',
  columns: ['Date', 'Gestational Age', 'PI/RI Values', 'Flow Pattern', 'Provider'],
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
      'PI/RI Values': getValue(entry.piRiValues || entry.values),
      'Flow Pattern': getValue(entry.flowPattern || entry.flow),
      Provider: getValue(entry.provider)
    }));
  }
};
