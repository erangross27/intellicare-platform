module.exports = {
  title: '📜 Provider License',
  columns: ['Date', 'Provider Name', 'License Number', 'State', 'Expiration'],
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
      'License Number': getValue(entry.licenseNumber || entry.license),
      State: getValue(entry.state || entry.jurisdiction),
      Expiration: getValue(entry.expiration || entry.expiryDate)
    }));
  }
};
