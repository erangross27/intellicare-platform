module.exports = {
  title: '🏃 Exercise Program',
  columns: ['Date', 'Exercise Type', 'Duration', 'Frequency', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Exercise Type': getValue(entry.exerciseType || entry.type),
      Duration: getValue(entry.duration || entry.time),
      Frequency: getValue(entry.frequency || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
