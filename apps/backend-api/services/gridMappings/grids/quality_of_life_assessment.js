module.exports = {
  title: '😊 Quality of Life',
  columns: ['Date', 'Score', 'Physical Health', 'Mental Health', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Score: getValue(entry.score || entry.qolScore),
      'Physical Health': getValue(entry.physicalHealth || entry.physical),
      'Mental Health': getValue(entry.mentalHealth || entry.mental),
      Provider: getValue(entry.provider)
    }));
  }
};
