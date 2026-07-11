module.exports = {
  title: '✍️ Provider Signature',
  columns: ['Date', 'Provider Name', 'Document Type', 'Time Signed', 'Electronic'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Provider Name': getValue(entry.providerName || entry.name),
      'Document Type': getValue(entry.documentType || entry.document),
      'Time Signed': getValue(entry.timeSigned || entry.timestamp),
      Electronic: getValue(entry.electronic || entry.method)
    }));
  }
};
