module.exports = {
  title: '🔬 PSA Screening',
  columns: ['Date', 'PSA Level', 'Trend', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'PSA Level': getValue(entry.psaLevel || entry.psa),
      Trend: getValue(entry.trend || entry.change),
      Interpretation: getValue(entry.interpretation || entry.assessment),
      Provider: getValue(entry.provider)
    }));
  }
};
