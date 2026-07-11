module.exports = {
  title: '📋 Administrative Data',
  columns: ['Type', 'Value', 'Status', 'Last Updated'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Type: getValue(entry.type || entry.category || entry.field),
      Value: getValue(entry.value || entry.data || entry.contact),
      Status: getValue(entry.status, 'Active'),
      'Last Updated': entry.date ? new Date(entry.date).toLocaleDateString() : (entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '-')
    }));
  }
};
