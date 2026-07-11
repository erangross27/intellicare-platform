module.exports = {
  title: '📋 FMLA Documentation',
  columns: ['Date', 'Reason', 'Duration', 'Restrictions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Reason: getValue(entry.reason || entry.medicalCondition),
      Duration: getValue(entry.duration || entry.leaveLength),
      Restrictions: getValue(entry.restrictions || entry.workLimitations),
      Provider: getValue(entry.provider)
    }));
  }
};
