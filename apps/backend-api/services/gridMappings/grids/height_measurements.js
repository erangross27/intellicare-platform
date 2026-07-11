module.exports = {
  title: '📏 Height Measurements',
  columns: ['Date', 'Height', 'Method', 'Provider', 'Notes'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Height: getValue(entry.height || entry.value),
      Method: getValue(entry.method || entry.technique, 'Standing'),
      Provider: getValue(entry.provider),
      Notes: getValue(entry.notes || entry.comments)
    }));
  }
};
