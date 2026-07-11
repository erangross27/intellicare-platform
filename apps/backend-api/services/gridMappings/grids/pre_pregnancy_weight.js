module.exports = {
  title: '⚖️ Pre-Pregnancy Weight',
  columns: ['Date', 'Weight', 'BMI', 'Height', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight || entry.value),
      BMI: getValue(entry.bmi || entry.bodyMassIndex),
      Height: getValue(entry.height),
      Provider: getValue(entry.provider)
    }));
  }
};
