module.exports = {
  title: '⏱️ Operative Time',
  columns: ['Date', 'Procedure', 'Start Time', 'End Time', 'Duration'],
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
      'Start Time': getValue(entry.startTime || entry.incisionTime),
      'End Time': getValue(entry.endTime || entry.closureTime),
      Duration: getValue(entry.duration || entry.operativeTime)
    }));
  }
};
