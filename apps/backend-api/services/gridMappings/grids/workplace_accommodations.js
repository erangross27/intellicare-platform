module.exports = {
  title: '🏢 Workplace Accommodations',
  columns: ['Date', 'Condition', 'Accommodations', 'Duration', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Condition: getValue(entry.condition || entry.diagnosis),
      Accommodations: getValue(entry.accommodations || entry.modifications),
      Duration: getValue(entry.duration || entry.timeframe),
      Provider: getValue(entry.provider)
    }));
  }
};
