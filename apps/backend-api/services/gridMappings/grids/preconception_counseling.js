module.exports = {
  title: '🤰 Preconception Counseling',
  columns: ['Date', 'Topics Discussed', 'Recommendations', 'Labs Ordered', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Topics Discussed': getValue(entry.topicsDiscussed || entry.topics),
      Recommendations: getValue(entry.recommendations || entry.advice),
      'Labs Ordered': getValue(entry.labsOrdered || entry.tests),
      Provider: getValue(entry.provider)
    }));
  }
};
