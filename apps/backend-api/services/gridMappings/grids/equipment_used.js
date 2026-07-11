module.exports = {
  title: '🔧 Equipment Used',
  columns: ['Date', 'Equipment', 'Purpose', 'Duration', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Equipment: getValue(entry.equipment || entry.name),
      Purpose: getValue(entry.purpose || entry.indication),
      Duration: getValue(entry.duration || entry.time),
      Provider: getValue(entry.provider)
    }));
  }
};
