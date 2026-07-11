module.exports = {
  title: '📄 Document Metadata',
  columns: ['Date', 'Document Type', 'Source', 'Pages', 'Status'],
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
      Source: getValue(entry.source || entry.origin),
      Pages: getValue(entry.pages || entry.pageCount),
      Status: getValue(entry.status, 'Processed')
    }));
  }
};
