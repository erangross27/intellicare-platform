module.exports = {
  title: '📋 Case Management',
  columns: ['Date', 'Issue', 'Intervention', 'Case Manager', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Issue: getValue(entry.issue || entry.concern),
      Intervention: getValue(entry.intervention || entry.action),
      'Case Manager': getValue(entry.caseManager || entry.manager),
      Status: getValue(entry.status, 'Open')
    }));
  }
};
