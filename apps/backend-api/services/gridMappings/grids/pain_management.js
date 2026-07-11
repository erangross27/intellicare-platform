module.exports = {
  title: '💊 Pain Management',
  columns: ['Date', 'Pain Level', 'Treatment', 'Effectiveness', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Pain Level': getValue(entry.painLevel || entry.painScore),
      Treatment: getValue(entry.treatment || entry.intervention),
      Effectiveness: getValue(entry.effectiveness || entry.response),
      Provider: getValue(entry.provider)
    }));
  }
};
