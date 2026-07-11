module.exports = {
  title: '🩺 Ostomy Care',
  columns: ['Date', 'Ostomy Type', 'Output', 'Skin Condition', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Ostomy Type': getValue(entry.ostomyType || entry.type),
      Output: getValue(entry.output || entry.drainage),
      'Skin Condition': getValue(entry.skinCondition || entry.periStomalSkin),
      Provider: getValue(entry.provider)
    }));
  }
};
