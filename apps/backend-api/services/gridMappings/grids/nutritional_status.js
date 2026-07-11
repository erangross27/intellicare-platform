module.exports = {
  title: '🍎 Nutritional Status',
  columns: ['Date', 'Weight', 'BMI', 'Assessment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight),
      BMI: getValue(entry.bmi || entry.bodyMassIndex),
      Assessment: getValue(entry.assessment || entry.status),
      Provider: getValue(entry.provider)
    }));
  }
};
