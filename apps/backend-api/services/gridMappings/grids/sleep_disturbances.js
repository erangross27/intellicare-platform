module.exports = {
  title: '😴 Sleep Disturbances',
  columns: ['Date', 'Type', 'Frequency', 'Impact', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.disturbanceType),
      Frequency: getValue(entry.frequency || entry.occurrence),
      Impact: getValue(entry.impact || entry.severity),
      Provider: getValue(entry.provider)
    }));
  }
};
