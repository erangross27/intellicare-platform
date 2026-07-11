module.exports = {
  title: '🔧 Port Placement',
  columns: ['Date', 'Port Location', 'Port Size', 'Technique', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Port Location': getValue(entry.portLocation || entry.location),
      'Port Size': getValue(entry.portSize || entry.size),
      Technique: getValue(entry.technique || entry.method),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
