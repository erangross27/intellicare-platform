module.exports = {
  title: '🧵 Closure Method',
  columns: ['Date', 'Layer', 'Suture Type', 'Technique', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Layer: getValue(entry.layer || entry.anatomicalLayer),
      'Suture Type': getValue(entry.sutureType || entry.suture),
      Technique: getValue(entry.technique || entry.method),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
