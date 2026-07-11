module.exports = {
  title: '💉 Insulin Storage Instructions',
  columns: ['Date', 'Insulin Type', 'Storage Method', 'Expiration', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Insulin Type': getValue(entry.insulinType || entry.type),
      'Storage Method': getValue(entry.storageMethod || entry.storage),
      Expiration: getValue(entry.expiration || entry.expiryDate),
      Provider: getValue(entry.provider)
    }));
  }
};
