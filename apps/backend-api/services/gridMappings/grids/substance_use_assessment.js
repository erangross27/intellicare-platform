module.exports = {
  title: '🚬 Substance Use Assessment',
  columns: ['Date', 'Substance', 'Frequency', 'Risk Level', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Substance: getValue(entry.substance || entry.drug),
      Frequency: getValue(entry.frequency || entry.use),
      'Risk Level': getValue(entry.riskLevel || entry.severity),
      Provider: getValue(entry.provider)
    }));
  }
};
