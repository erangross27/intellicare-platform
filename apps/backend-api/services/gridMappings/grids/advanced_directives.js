module.exports = {
  title: '📋 Advanced Directives',
  columns: ['Date', 'Directive Type', 'Status', 'Representative', 'Provider'],
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
      Status: getValue(entry.status || entry.currentStatus),
      Representative: getValue(entry.representative || entry.healthcareProxy),
      Provider: getValue(entry.provider)
    }));
  }
};
