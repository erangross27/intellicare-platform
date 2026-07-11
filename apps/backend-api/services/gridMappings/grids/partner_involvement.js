module.exports = {
  title: '👥 Partner Involvement',
  columns: ['Date', 'Activity', 'Participation', 'Education', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Activity: getValue(entry.activity || entry.type),
      Participation: getValue(entry.participation || entry.level),
      Education: getValue(entry.education || entry.training),
      Provider: getValue(entry.provider)
    }));
  }
};
