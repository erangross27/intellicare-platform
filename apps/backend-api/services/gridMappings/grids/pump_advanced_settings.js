module.exports = {
  title: '⚙️ Pump Advanced Settings',
  columns: ['Date', 'Basal Rates', 'I:C Ratios', 'ISF', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Basal Rates': getValue(entry.basalRates || entry.basal),
      icRatios: getValue(entry.icRatios || entry.carbRatio),
      ISF: getValue(entry.isf || entry.correctionFactor),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
