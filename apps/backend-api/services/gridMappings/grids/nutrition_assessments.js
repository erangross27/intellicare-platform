module.exports = {
  title: '🥗 Nutrition Assessments',
  columns: ['Date', 'Diet History', 'Nutritional Status', 'Recommendations', 'Dietitian'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Diet History': getValue(entry.dietHistory || entry.dietary),
      'Nutritional Status': getValue(entry.nutritionalStatus || entry.status),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Dietitian: getValue(entry.dietitian || entry.provider)
    }));
  }
};
