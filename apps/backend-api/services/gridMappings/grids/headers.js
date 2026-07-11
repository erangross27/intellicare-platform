module.exports = {
  title: '📌 Document Headers',
  columns: ['Date', 'Header Type', 'Content', 'Document', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Header Type': getValue(entry.headerType || entry.type),
      Content: getValue(entry.content || entry.text),
      Document: getValue(entry.document || entry.documentType),
      Provider: getValue(entry.provider)
    }));
  }
};
