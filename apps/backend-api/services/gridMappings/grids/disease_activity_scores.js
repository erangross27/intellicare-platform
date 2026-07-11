module.exports = {
  title: '📊 Disease Activity Scores',
  columns: ['Date', 'Score Name', 'Value', 'Category', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Score Name': getValue(entry.scoreName || entry.name || entry.type),
      Value: getValue(entry.value || entry.score),
      Category: getValue(entry.category || entry.severity),
      Provider: getValue(entry.provider)
    }));
  }
};
