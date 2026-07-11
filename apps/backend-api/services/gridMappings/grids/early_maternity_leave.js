module.exports = {
  title: '🤰 Early Maternity Leave',
  columns: ['Date', 'Reason', 'Start Date', 'Duration', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Reason: getValue(entry.reason || entry.indication),
      'Start Date': entry.startDate ? new Date(entry.startDate).toLocaleDateString() : '-',
      Duration: getValue(entry.duration || entry.weeks),
      Provider: getValue(entry.provider || entry.obstetrician)
    }));
  }
};
