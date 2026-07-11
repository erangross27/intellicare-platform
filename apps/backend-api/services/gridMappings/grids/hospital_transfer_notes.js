module.exports = {
  title: '🔄 Hospital Transfer Notes',
  columns: ['Date', 'From Unit', 'To Unit', 'Reason', 'Condition'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'From Unit': getValue(entry.fromUnit || entry.transferFrom),
      'To Unit': getValue(entry.toUnit || entry.transferTo),
      Reason: getValue(entry.reason || entry.transferReason),
      Condition: getValue(entry.condition || entry.patientCondition)
    }));
  }
};
