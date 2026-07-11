module.exports = {
  title: '📋 Advanced Care Planning',
  columns: ['Date', 'Directive Type', 'Decision', 'Health Proxy', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Directive Type': getValue(entry.directiveType || entry.type),
      Decision: getValue(entry.decision || entry.preference),
      'Health Proxy': getValue(entry.healthProxy || entry.proxy),
      Status: getValue(entry.status || entry.completed, 'Active')
    }));
  }
};
