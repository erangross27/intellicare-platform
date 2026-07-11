module.exports = {
  title: '🍎 Food Assistance Programs',
  columns: ['Program Name', 'Enrollment Date', 'Benefits', 'Status', 'Case Worker'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Program Name': getValue(entry.programName || entry.program),
      'Enrollment Date': entry.enrollmentDate ? new Date(entry.enrollmentDate).toLocaleDateString() : '-',
      Benefits: getValue(entry.benefits || entry.amount),
      Status: getValue(entry.status, 'Active'),
      'Case Worker': getValue(entry.caseWorker || entry.contact)
    }));
  }
};
