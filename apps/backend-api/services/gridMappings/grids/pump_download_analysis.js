module.exports = {
  title: '📱 Pump Download Analysis',
  columns: ['Date', 'Average BG', 'Insulin Total', 'TIR', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Average BG': getValue(entry.averageBg || entry.meanGlucose),
      'Insulin Total': getValue(entry.insulinTotal || entry.totalDailyDose),
      TIR: getValue(entry.tir || entry.timeInRange),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
