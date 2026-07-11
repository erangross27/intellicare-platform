module.exports = {
  title: '🍽️ Malnutrition Risk Assessment',
  columns: ['Date', 'Risk Category', 'Risk Score', 'BMI', 'Intervention Required'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Category': getValue(entry.riskCategory),
      'Risk Score': getValue(entry.totalRiskScore),
      BMI: getValue(entry.bodyMassIndex),
      'Intervention Required': entry.nutritionInterventionRequired === true ? 'Yes' : entry.nutritionInterventionRequired === false ? 'No' : '-'
    }));
  }
};
