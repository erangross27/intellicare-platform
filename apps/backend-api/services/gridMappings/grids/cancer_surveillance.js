module.exports = {
  title: '🔍 Cancer Surveillance',
  columns: ['Date', 'Test/Exam', 'Result', 'Next Due', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test/Exam': getValue(entry.test || entry.examination || entry.surveillance),
      Result: getValue(entry.result || entry.findings),
      'Next Due': entry.nextDue ? new Date(entry.nextDue).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
