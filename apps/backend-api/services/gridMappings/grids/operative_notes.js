module.exports = {
  title: '🔪 Operative Notes',
  columns: ['Date', 'Procedure', 'Findings', 'Complications', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      Findings: getValue(entry.findings || entry.intraoperativeFindings),
      Complications: getValue(entry.complications || entry.issues),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
