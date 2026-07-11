module.exports = {
  title: '⏰ Insulin Timing Instructions',
  columns: ['Date', 'Insulin Type', 'Timing', 'Meal Relation', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Insulin Type': getValue(entry.insulinType || entry.type),
      Timing: getValue(entry.timing || entry.when),
      'Meal Relation': getValue(entry.mealRelation || entry.mealTiming),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
