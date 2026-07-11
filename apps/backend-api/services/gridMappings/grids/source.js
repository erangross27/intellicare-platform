module.exports = {
  title: '📚 Source',
  columns: ['Date', 'Source Type', 'Document', 'Provider', 'Institution'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Source Type': getValue(entry.sourceType || entry.type),
      Document: getValue(entry.document || entry.documentName),
      Provider: getValue(entry.provider),
      Institution: getValue(entry.institution || entry.facility)
    }));
  }
};
