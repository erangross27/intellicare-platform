module.exports = {
  title: '☣️ Environmental Exposures',
  columns: ['Date', 'Exposure', 'Duration', 'Level', 'Intervention'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Exposure: getValue(entry.exposure || entry.agent),
      Duration: getValue(entry.duration || entry.period),
      Level: getValue(entry.level || entry.severity),
      Intervention: getValue(entry.intervention || entry.action)
    }));
  }
};
