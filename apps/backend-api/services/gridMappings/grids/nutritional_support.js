module.exports = {
  title: '🍎 Nutritional Support',
  columns: ['Date', 'Support Type', 'Caloric Goal', 'Route', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Support Type': getValue(entry.supportType || entry.type),
      'Caloric Goal': getValue(entry.caloricGoal || entry.calories),
      Route: getValue(entry.route || entry.administration),
      Provider: getValue(entry.provider)
    }));
  }
};
