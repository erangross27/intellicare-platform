module.exports = {
  title: '🏠 Living Situation',
  columns: ['Date', 'Living Arrangement', 'Support Level', 'Safety', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Living Arrangement': getValue(entry.livingArrangement || entry.housing),
      'Support Level': getValue(entry.supportLevel || entry.assistance),
      Safety: getValue(entry.safety || entry.safetyAssessment),
      Provider: getValue(entry.provider)
    }));
  }
};
