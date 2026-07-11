module.exports = {
  title: 'Parenteral Nutrition Monitoring',
  columns: ['Date', 'Weight', 'Glucose', 'Calories', 'Central Line', 'Refeeding Risk'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.patientWeight),
      Glucose: getValue(entry.bloodGlucose),
      Calories: getValue(entry.totalCaloriesProvided),
      'Central Line': getValue(entry.centralLineType),
      'Refeeding Risk': getValue(entry.refeedingSyndromeRiskScore)
    }));
  }
};
