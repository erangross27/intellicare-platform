module.exports = {
  title: '👶 Fetal Surveillance',
  columns: ['Date', 'Test Type', 'Result', 'BPP Score', 'Plan'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Type': getValue(entry.testType || entry.test),
      Result: getValue(entry.result || entry.outcome),
      'BPP Score': getValue(entry.bppScore || entry.biophysicalProfile),
      Plan: getValue(entry.plan || entry.followUp)
    }));
  }
};
