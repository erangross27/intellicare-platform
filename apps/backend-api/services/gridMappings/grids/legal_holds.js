module.exports = {
  title: '⚖️ Legal Holds',
  columns: ['Date', 'Type', 'Reason', 'Status', 'Contact'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.holdType),
      Reason: getValue(entry.reason || entry.legalBasis),
      Status: getValue(entry.status || entry.currentStatus),
      Contact: getValue(entry.contact || entry.attorney)
    }));
  }
};
