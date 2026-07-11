module.exports = {
  title: '🔪 Surgical Steps',
  columns: ['Date', 'Step Number', 'Description', 'Findings', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Step Number': getValue(entry.stepNumber || entry.step),
      Description: getValue(entry.description || entry.stepDescription),
      Findings: getValue(entry.findings || entry.observations),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
