module.exports = {
  title: '🔨 Reflex Testing',
  columns: ['Date', 'Reflex', 'Left', 'Right', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Reflex: getValue(entry.reflex || entry.reflexType),
      Left: getValue(entry.left || entry.leftResponse),
      Right: getValue(entry.right || entry.rightResponse),
      Provider: getValue(entry.provider)
    }));
  }
};
