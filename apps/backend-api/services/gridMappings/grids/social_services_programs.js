module.exports = {
  title: '🏘️ Social Services Programs',
  columns: ['Date', 'Program', 'Services', 'Status', 'Case Worker'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Program: getValue(entry.program || entry.programName),
      Services: getValue(entry.services || entry.assistance),
      Status: getValue(entry.status || entry.enrollmentStatus),
      'Case Worker': getValue(entry.caseWorker || entry.provider)
    }));
  }
};
