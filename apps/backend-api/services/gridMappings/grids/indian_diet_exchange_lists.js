module.exports = {
  title: '🍽️ Indian Diet Exchange Lists',
  columns: ['Date', 'Food Group', 'Serving Size', 'Exchanges', 'Nutritionist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Food Group': getValue(entry.foodGroup || entry.category),
      'Serving Size': getValue(entry.servingSize || entry.portion),
      Exchanges: getValue(entry.exchanges || entry.equivalents),
      Nutritionist: getValue(entry.nutritionist || entry.provider)
    }));
  }
};
