module.exports = {
  title: '🧪 Metabolic Panel',
  columns: ['Date', 'Glucose', 'Sodium', 'Potassium', 'Creatinine'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Glucose: getValue(entry.glucose || entry.bloodGlucose),
      Sodium: getValue(entry.sodium || entry.na),
      Potassium: getValue(entry.potassium || entry.k),
      Creatinine: getValue(entry.creatinine || entry.cr)
    }));
  }
};
