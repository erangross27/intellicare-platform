module.exports = {
  title: '💉 Thromboprophylaxis',
  columns: ['Date', 'Method', 'Agent', 'Duration', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Method: getValue(entry.method || entry.type),
      Agent: getValue(entry.agent || entry.medication),
      Duration: getValue(entry.duration || entry.timeframe),
      Provider: getValue(entry.provider)
    }));
  }
};
