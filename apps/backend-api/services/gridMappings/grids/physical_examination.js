module.exports = {
  title: '🔍 Physical Examination',
  columns: ['Date', 'System', 'Findings', 'Abnormalities', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      System: getValue(entry.system || entry.bodySystem),
      Findings: getValue(entry.findings || entry.examination),
      Abnormalities: getValue(entry.abnormalities || entry.notable),
      Provider: getValue(entry.provider)
    }));
  }
};
