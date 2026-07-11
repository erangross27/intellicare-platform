module.exports = {
  title: '🚫 Activity Restrictions',
  columns: ['Date', 'Restriction', 'Duration', 'Reason', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Restriction: getValue(entry.restriction || entry.activity),
      Duration: getValue(entry.duration || entry.timeframe),
      Reason: getValue(entry.reason || entry.indication),
      Provider: getValue(entry.provider)
    }));
  }
};
