module.exports = {
  title: '🛡️ Preventive Care',
  columns: ['Date', 'Service', 'Due Date', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Service: getValue(entry.service || entry.screening),
      'Due Date': getValue(entry.dueDate || entry.nextDue),
      Status: getValue(entry.status || entry.completed),
      Provider: getValue(entry.provider)
    }));
  }
};
