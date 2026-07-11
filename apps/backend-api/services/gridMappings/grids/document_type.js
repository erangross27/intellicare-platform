module.exports = {
  title: '📄 Document Types',
  columns: ['Date', 'Document Type', 'Category', 'Description', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Document Type': getValue(entry.documentType || entry.type),
      Category: getValue(entry.category || entry.classification),
      Description: getValue(entry.description || entry.summary),
      Provider: getValue(entry.provider)
    }));
  }
};
