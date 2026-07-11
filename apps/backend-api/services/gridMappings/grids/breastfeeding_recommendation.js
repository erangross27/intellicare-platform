module.exports = {
  title: '🤱 Breastfeeding Recommendation',
  columns: ['Date', 'Recommendation', 'Support', 'Adjustments', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Recommendation: getValue(entry.recommendation || entry.plan),
      Support: getValue(entry.support || entry.resources),
      Adjustments: getValue(entry.adjustments || entry.modifications),
      Provider: getValue(entry.provider)
    }));
  }
};
