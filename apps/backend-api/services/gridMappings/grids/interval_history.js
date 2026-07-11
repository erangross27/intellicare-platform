module.exports = {
  title: '📅 Interval History',
  columns: ['Date', 'Since Last Visit', 'Changes', 'Concerns', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Since Last Visit': getValue(entry.sinceLastVisit || entry.interval),
      Changes: getValue(entry.changes || entry.newSymptoms),
      Concerns: getValue(entry.concerns || entry.issues),
      Provider: getValue(entry.provider)
    }));
  }
};
