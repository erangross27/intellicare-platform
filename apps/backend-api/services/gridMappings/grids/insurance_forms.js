module.exports = {
  title: '📄 Insurance Forms',
  columns: ['Date', 'Form Type', 'Purpose', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Form Type': getValue(entry.formType || entry.type),
      Purpose: getValue(entry.purpose || entry.reason),
      Status: getValue(entry.status || entry.completionStatus),
      Provider: getValue(entry.provider)
    }));
  }
};
