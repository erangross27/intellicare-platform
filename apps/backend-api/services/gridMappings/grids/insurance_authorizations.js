module.exports = {
  title: '📄 Insurance Authorizations',
  columns: ['Date', 'Service', 'Authorization Number', 'Valid Until', 'Provider'],
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
      'Authorization Number': getValue(entry.authorizationNumber || entry.authNumber),
      'Valid Until': entry.validUntil ? new Date(entry.validUntil).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
