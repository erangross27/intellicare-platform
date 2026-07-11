module.exports = {
  title: '🧵 Closure Technique',
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
      Layer: getValue(entry.layer || entry.closureLayer),
      'Suture Type': getValue(entry.sutureType || entry.suture),
      Technique: getValue(entry.technique || entry.closureMethod),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
