module.exports = {
  title: '🔪 Operative Report Details',
  columns: ['Date', 'Procedure', 'Findings', 'Technique', 'Surgeon'],
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
      Technique: getValue(entry.technique || entry.surgicalTechnique),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
