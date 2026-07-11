module.exports = {
  title: '🧠 Biopsychosocial Formulation',
  columns: ['Date', 'Biological Factors', 'Psychological Factors', 'Social Factors', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Biological Factors': getValue(entry.biologicalFactors || entry.biological),
      'Psychological Factors': getValue(entry.psychologicalFactors || entry.psychological),
      'Social Factors': getValue(entry.socialFactors || entry.social),
      Provider: getValue(entry.provider)
    }));
  }
};
