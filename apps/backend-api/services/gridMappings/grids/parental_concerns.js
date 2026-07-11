module.exports = {
  title: '👨‍👩‍👧 Parental Concerns',
  columns: ['Date', 'Concerns', 'Category', 'Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Concerns: getValue(entry.concerns || entry.issue),
      Category: getValue(entry.category || entry.type),
      Response: getValue(entry.response || entry.action),
      Provider: getValue(entry.provider)
    }));
  }
};
