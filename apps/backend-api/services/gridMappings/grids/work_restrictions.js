module.exports = {
  title: '💼 Work Restrictions',
  columns: ['Date', 'Restrictions', 'Duration', 'Reason', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Restrictions: getValue(entry.restrictions || entry.limitations),
      Duration: getValue(entry.duration || entry.timeframe),
      Reason: getValue(entry.reason || entry.indication),
      Provider: getValue(entry.provider)
    }));
  }
};
