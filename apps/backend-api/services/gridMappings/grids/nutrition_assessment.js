module.exports = {
  title: '🥗 Nutrition Assessment',
  columns: ['Date', 'BMI', 'Dietary Intake', 'Recommendations', 'Dietitian'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      BMI: getValue(entry.bmi || entry.bodyMassIndex),
      'Dietary Intake': getValue(entry.dietaryIntake || entry.diet),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Dietitian: getValue(entry.dietitian || entry.provider)
    }));
  }
};
