module.exports = {
  title: '🏅 Provider Board Certification',
  columns: ['Date', 'Provider Name', 'Board', 'Certification Date', 'Expiration'],
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
      Board: getValue(entry.board || entry.certifyingBoard),
      'Certification Date': getValue(entry.certificationDate || entry.certified),
      Expiration: getValue(entry.expiration || entry.expiryDate)
    }));
  }
};
