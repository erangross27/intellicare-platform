module.exports = {
  title: '🩺 Physical Exam',
  columns: ['Date', 'System', 'Findings', 'Abnormal', 'Provider'],
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
      Abnormal: getValue(entry.abnormal || entry.abnormalFindings),
      Provider: getValue(entry.provider)
    }));
  }
};
