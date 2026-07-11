module.exports = {
  title: '🍎 Nutritional Assessment',
  columns: ['Date', 'BMI', 'Dietary Intake', 'Deficiencies', 'Nutritionist'],
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
      Deficiencies: getValue(entry.deficiencies || entry.nutritionalGaps),
      Nutritionist: getValue(entry.nutritionist || entry.provider)
    }));
  }
};
