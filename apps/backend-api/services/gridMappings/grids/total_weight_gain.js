module.exports = {
  title: '⚖️ Total Weight Gain',
  columns: ['Date', 'Current Weight', 'Total Gain', 'Target Range', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Current Weight': getValue(entry.currentWeight || entry.weight),
      'Total Gain': getValue(entry.totalGain || entry.gain),
      'Target Range': getValue(entry.targetRange || entry.target),
      Provider: getValue(entry.provider)
    }));
  }
};
