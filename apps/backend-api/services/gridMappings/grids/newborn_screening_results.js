module.exports = {
  title: '👶 Newborn Screening Results',
  columns: ['Date', 'Test Name', 'Result', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Name': getValue(entry.testName || entry.test),
      Result: getValue(entry.result || entry.value),
      Status: getValue(entry.status || entry.interpretation),
      Provider: getValue(entry.provider)
    }));
  }
};
