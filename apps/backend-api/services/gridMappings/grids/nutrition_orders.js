module.exports = {
  title: '🍽️ Nutrition Orders',
  columns: ['Date', 'Diet Type', 'Restrictions', 'Supplements', 'Provider'],
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
      Restrictions: getValue(entry.restrictions || entry.limitations),
      Supplements: getValue(entry.supplements || entry.additives),
      Provider: getValue(entry.provider)
    }));
  }
};
