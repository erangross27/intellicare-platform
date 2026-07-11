module.exports = {
  title: '🧪 Ketone Monitoring Instructions',
  columns: ['Date', 'When to Test', 'Target Range', 'Action Steps', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'When to Test': getValue(entry.whenToTest || entry.timing),
      'Target Range': getValue(entry.targetRange || entry.normalRange),
      'Action Steps': getValue(entry.actionSteps || entry.ifAbnormal),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
