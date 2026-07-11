module.exports = {
  title: '🍽️ Diet Orders',
  columns: ['Date', 'Diet Type', 'Consistency', 'Restrictions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Diet Type': getValue(entry.dietType || entry.diet),
      Consistency: getValue(entry.consistency || entry.texture),
      Restrictions: getValue(entry.restrictions || entry.modifications),
      Provider: getValue(entry.provider)
    }));
  }
};
