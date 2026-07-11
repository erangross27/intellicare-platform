module.exports = {
  title: '🌍 Cultural Considerations',
  columns: ['Date', 'Factor', 'Impact on Care', 'Accommodations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Factor: getValue(entry.factor || entry.consideration),
      'Impact on Care': getValue(entry.impactOnCare || entry.impact),
      Accommodations: getValue(entry.accommodations || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
