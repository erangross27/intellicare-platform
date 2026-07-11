module.exports = {
  title: '🤝 Care Coordination',
  columns: ['Date', 'Service', 'Provider', 'Contact', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Service: getValue(entry.service || entry.type),
      Provider: getValue(entry.provider || entry.coordinator),
      Contact: getValue(entry.contact || entry.phone),
      Status: getValue(entry.status, 'Active')
    }));
  }
};
