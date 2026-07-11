module.exports = {
  title: '📊 Excessive Glucose Monitoring',
  columns: ['Date', 'Testing Frequency', 'Reason', 'Adjustments', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Testing Frequency': getValue(entry.testingFrequency || entry.frequency),
      Reason: getValue(entry.reason || entry.indication),
      Adjustments: getValue(entry.adjustments || entry.modifications),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
