module.exports = {
  title: '📊 CGM Discussion',
  columns: ['Date', 'Topic', 'Time in Range', 'Recommendations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Topic: getValue(entry.topic || entry.discussion),
      'Time in Range': getValue(entry.timeInRange || entry.tir),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
