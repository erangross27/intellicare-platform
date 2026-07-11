module.exports = {
  title: '📅 Follow-up Plan',
  columns: ['Date', 'Follow-up Type', 'Timeframe', 'Instructions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Follow-up Type': getValue(entry.followUpType || entry.type),
      Timeframe: getValue(entry.timeframe || entry.when),
      Instructions: getValue(entry.instructions || entry.details),
      Provider: getValue(entry.provider)
    }));
  }
};
