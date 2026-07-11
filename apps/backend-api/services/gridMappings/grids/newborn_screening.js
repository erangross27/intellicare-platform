module.exports = {
  title: '👶 Newborn Screening',
  columns: ['Date', 'Test', 'Result', 'Follow-up', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Test: getValue(entry.test || entry.screeningTest),
      Result: getValue(entry.result || entry.findings),
      'Follow-up': getValue(entry.followUp || entry.action),
      Provider: getValue(entry.provider)
    }));
  }
};
