module.exports = {
  title: '📋 Problem List',
  columns: ['Date', 'Problem', 'Status', 'Onset Date', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Problem: getValue(entry.problem || entry.diagnosis),
      Status: getValue(entry.status || entry.problemStatus),
      'Onset Date': entry.onsetDate ? new Date(entry.onsetDate).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
