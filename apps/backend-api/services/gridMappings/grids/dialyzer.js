module.exports = {
  title: '💧 Dialyzer Information',
  columns: ['Date', 'Type', 'Surface Area', 'Reuse Number', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.dialyzerType),
      'Surface Area': getValue(entry.surfaceArea || entry.area),
      'Reuse Number': getValue(entry.reuseNumber || entry.reuse),
      Provider: getValue(entry.provider)
    }));
  }
};
