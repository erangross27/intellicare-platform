module.exports = {
  title: '💉 IV Access',
  columns: ['Date/Time', 'Site', 'Type', 'Size', 'Placed By'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Site: getValue(entry.site || entry.location),
      Type: getValue(entry.type || entry.catheterType),
      Size: getValue(entry.size || entry.gauge),
      'Placed By': getValue(entry.placedBy || entry.provider)
    }));
  }
};
