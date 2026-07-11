module.exports = {
  title: '📊 Glucose Testing Weeks',
  columns: ['Week', 'Tests Ordered', 'Results', 'Follow-up', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Tests Ordered': getValue(entry.testsOrdered || entry.tests),
      Results: getValue(entry.results || entry.values),
      'Follow-up': getValue(entry.followUp || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
