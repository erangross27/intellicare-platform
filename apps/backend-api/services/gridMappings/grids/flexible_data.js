module.exports = {
  title: '📊 Flexible Data',
  columns: ['Date', 'Category', 'Field', 'Value', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Category: getValue(entry.category || entry.type),
      Field: getValue(entry.field || entry.fieldName),
      Value: getValue(entry.value || entry.data),
      Provider: getValue(entry.provider)
    }));
  }
};
