module.exports = {
  title: '🥗 Nutrition Consultation',
  columns: ['Date', 'Indication', 'Recommendations', 'Goals', 'Dietitian'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Goals: getValue(entry.goals || entry.nutritionGoals),
      Dietitian: getValue(entry.dietitian || entry.provider)
    }));
  }
};
