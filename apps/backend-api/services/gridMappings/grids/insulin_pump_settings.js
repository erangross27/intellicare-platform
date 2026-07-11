module.exports = {
  title: '⚙️ Insulin Pump Settings',
  columns: ['Date', 'Basal Rate', 'Carb Ratio', 'Correction Factor', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Basal Rate': getValue(entry.basalRate || entry.basal),
      'Carb Ratio': getValue(entry.carbRatio || entry.icRatio),
      'Correction Factor': getValue(entry.correctionFactor || entry.isf),
      Provider: getValue(entry.provider)
    }));
  }
};
