module.exports = {
  title: '🚑 ED Course',
  columns: ['Date/Time', 'Event', 'Intervention', 'Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Event: getValue(entry.event || entry.finding),
      Intervention: getValue(entry.intervention || entry.treatment),
      Response: getValue(entry.response || entry.outcome),
      Provider: getValue(entry.provider)
    }));
  }
};
