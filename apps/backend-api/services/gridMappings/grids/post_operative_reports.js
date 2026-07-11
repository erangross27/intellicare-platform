module.exports = {
  title: '📋 Post-Operative Reports',
  columns: ['Date', 'Procedure', 'Condition', 'Complications', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      Condition: getValue(entry.condition || entry.postOpCondition),
      Complications: getValue(entry.complications || entry.issues),
      Provider: getValue(entry.provider)
    }));
  }
};
