module.exports = {
  title: '🎯 Treatment Goals',
  columns: ['Date', 'Goal', 'Target Date', 'Progress', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Goal: getValue(entry.goal || entry.objective),
      'Target Date': getValue(entry.targetDate || entry.deadline),
      Progress: getValue(entry.progress || entry.status),
      Provider: getValue(entry.provider)
    }));
  }
};
