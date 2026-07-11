module.exports = {
  title: '✅ Preventive Care Screening',
  columns: ['Date', 'Screening', 'Result', 'Due Date', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Screening: getValue(entry.screening || entry.test),
      Result: getValue(entry.result || entry.findings),
      'Due Date': entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
