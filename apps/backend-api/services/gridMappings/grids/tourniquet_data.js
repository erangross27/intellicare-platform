module.exports = {
  title: '⏱️ Tourniquet Data',
  columns: ['Date', 'Location', 'Pressure', 'Duration', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Location: getValue(entry.location || entry.site),
      Pressure: getValue(entry.pressure || entry.mmHg),
      Duration: getValue(entry.duration || entry.time),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
