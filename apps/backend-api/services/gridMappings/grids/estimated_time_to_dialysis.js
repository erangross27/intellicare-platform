module.exports = {
  title: '⏱️ Estimated Time to Dialysis',
  columns: ['Date', 'Current eGFR', 'Estimated Time', 'Recommendation', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Current eGFR': getValue(entry.currentEgfr || entry.eGFR),
      'Estimated Time': getValue(entry.estimatedTime || entry.timeToDialysis),
      Recommendation: getValue(entry.recommendation || entry.plan),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
