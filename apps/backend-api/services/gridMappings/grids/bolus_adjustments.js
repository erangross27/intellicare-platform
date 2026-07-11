module.exports = {
  title: '💉 Bolus Adjustments',
  columns: ['Date/Time', 'Carbs', 'Blood Glucose', 'Bolus Delivered', 'Correction'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Carbs: getValue(entry.carbs || entry.carbohydrates),
      'Blood Glucose': getValue(entry.bloodGlucose || entry.bg),
      'Bolus Delivered': getValue(entry.bolusDelivered || entry.bolus),
      Correction: getValue(entry.correction || entry.correctionBolus)
    }));
  }
};
