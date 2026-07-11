module.exports = {
  title: '📄 Raw Text',
  columns: ['Date', 'Source Document', 'Text Preview', 'Document Type', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Source Document': getValue(entry.sourceDocument || entry.document),
      'Text Preview': getValue(entry.textPreview || entry.text),
      'Document Type': getValue(entry.documentType || entry.type),
      Provider: getValue(entry.provider)
    }));
  }
};
