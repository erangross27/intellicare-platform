module.exports = {
  title: '📝 Patient Instructions',
  columns: ['Date', 'Instructions', 'Category', 'Urgency', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Instructions: getValue(entry.instructions || entry.details),
      Category: getValue(entry.category || entry.type),
      Urgency: getValue(entry.urgency || entry.priority),
      Provider: getValue(entry.provider)
    }));
  }
};
