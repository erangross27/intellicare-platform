module.exports = {
  title: 'Nutrition Support Consultation',
  columns: ['Date', 'BMI', 'Weight Loss %', 'Enteral Route', 'Parenteral Required'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.consultationDate ? new Date(entry.consultationDate).toLocaleDateString() : '-',
      'BMI': getValue(entry.currentBodyMassIndex),
      'Weight Loss %': getValue(entry.percentWeightLoss),
      'Enteral Route': getValue(entry.enteralNutritionRoute),
      'Parenteral Required': entry.parenteralNutritionRequired === true ? 'Yes' : entry.parenteralNutritionRequired === false ? 'No' : '-'
    }));
  }
};
