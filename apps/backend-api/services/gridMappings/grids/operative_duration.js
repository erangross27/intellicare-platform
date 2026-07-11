module.exports = {
  title: '⏱️ Operative Duration',
  columns: ['Date', 'Duration', 'Start Time', 'End Time', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Duration: getValue(entry.duration || entry.operativeTime),
      'Start Time': getValue(entry.startTime || entry.incisionTime),
      'End Time': getValue(entry.endTime || entry.closureTime),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
