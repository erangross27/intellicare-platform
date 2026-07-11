module.exports = {
  title: '📄 Insurance Authorization',
  columns: ['Date', 'Service', 'Status', 'Valid Until', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Service: getValue(entry.service || entry.requestedService),
      Status: getValue(entry.status || entry.approvalStatus),
      'Valid Until': entry.validUntil ? new Date(entry.validUntil).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
