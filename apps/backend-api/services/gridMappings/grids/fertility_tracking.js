module.exports = {
  title: '👶 Fertility Tracking',
  columns: ['Date', 'Cycle Day', 'Temperature', 'Ovulation', 'Notes'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cycle Day': getValue(entry.cycleDay || entry.day),
      Temperature: getValue(entry.temperature || entry.bbt),
      Ovulation: getValue(entry.ovulation || entry.lhSurge),
      Notes: getValue(entry.notes || entry.symptoms)
    }));
  }
};
