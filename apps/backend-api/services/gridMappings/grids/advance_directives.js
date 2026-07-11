module.exports = {
  title: '📜 Advance Directives',
  columns: ['Date', 'Directive Type', 'Status', 'Documented', 'Provider'],
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
      Status: getValue(entry.status || entry.state),
      Documented: getValue(entry.documented || entry.location),
      Provider: getValue(entry.provider)
    }));
  }
};
