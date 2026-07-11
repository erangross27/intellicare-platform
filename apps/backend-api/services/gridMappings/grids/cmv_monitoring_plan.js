module.exports = {
  title: '🦠 CMV Monitoring',
  columns: ['Date', 'Test Type', 'Result', 'Viral Load', 'Action'],
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
      Result: getValue(entry.result),
      'Viral Load': getValue(entry.viralLoad || entry.load),
      Action: getValue(entry.action || entry.plan)
    }));
  }
};
